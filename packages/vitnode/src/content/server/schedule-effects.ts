import type { Context } from "hono";

import { z } from "zod";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentEditorialOutcome } from "./editorial-service";

import { CONTENT_SCHEDULE_ACTIONS } from "../const";
import { contentEditorialEffects } from "./editorial-effects";
import { findContentModel } from "./model";
import { dispatchContentRevalidation } from "./revalidate-bridge";
import { recordContentScheduleEffectsError } from "./schedules-model";
import { isContentRowPublic } from "./search-document";

/**
 * Everything the announcements need, and nothing they have to re-read.
 *
 * Written when the transition commits and never consulted against the live
 * record afterwards. That is the point: by the time this runs the record may
 * have been edited again, and an event describing *that* state would be a
 * second, wrong announcement of a publication that already happened.
 */
export const contentScheduleEffectsPayloadSchema = z.object({
  changedFields: z.array(z.string()),
  contentTypeId: z.string().min(1),
  itemId: z.number().int().positive(),
  operation: z.enum(CONTENT_SCHEDULE_ACTIONS),
  pluginId: z.string().min(1),
  previousSlug: z.string().nullable(),
  /** `null` only if the transition somehow wrote no revision. */
  revisionId: z.number().int().positive().nullable(),
  /** The row as the transition returned it, JSON-flattened. */
  row: z.record(z.string(), z.unknown()),
  scheduleId: z.number().int().positive(),
  scheduledBy: z.number().int().nullable(),
  version: z.number().int().positive(),
  wasPublic: z.boolean(),
});

export type ContentScheduleEffectsPayload = z.infer<
  typeof contentScheduleEffectsPayloadSchema
>;

/**
 * Turns the ISO strings a JSON payload carries back into `Date`s.
 *
 * The search document already accepts either, but the `published` event payload
 * is typed `publishedAt: Date` - and a listener that reads it should not be able
 * to tell whether the publish was clicked or scheduled.
 */
const reviveDates = (
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
): Record<string, unknown> => {
  const dateColumns = [
    "createdAt",
    "updatedAt",
    ...(definition.publication.enabled ? ["publishedAt"] : []),
    ...Object.entries(definition.fields)
      .filter(([, field]) => field.kind === "dateTime")
      .map(([name]) => name),
  ];

  const revived = { ...row };
  for (const name of dateColumns) {
    const value = revived[name];
    if (typeof value !== "string") continue;

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) revived[name] = parsed;
  }

  return revived;
};

export interface ContentScheduleEffectsOutcome {
  /** Why this run failed, when it did. Also written to the schedule row. */
  error?: string;
  status: "delivered" | "unregistered";
}

/**
 * Delivers the announcements a committed scheduled transition owes everyone
 * else: its event, its search document, and its cache invalidation.
 *
 * **Split from the transition on purpose.** Publishing is a database write that
 * either committed or did not. Telling the world is three calls to systems a
 * transaction cannot reach, any of which can be down for a minute. Retrying
 * them together would re-run the publish - which is idempotent, so the second
 * run would find nothing changed and skip the announcements entirely. That is
 * exactly how a scheduled unpublish ends up permanently serving a cached page it
 * should have expired, and it is the failure this task exists to remove.
 *
 * **Delivery is at-least-once.** A retry after a partial failure re-emits the
 * event and re-writes the search document. Both of the latter are idempotent by
 * construction - a search upsert and a cache expiry are the same operation
 * however many times they run - but an event listener may see the same
 * `published` twice, so a listener that must act once needs its own
 * idempotency key. There is no outbox and no exactly-once claim.
 */
export const runContentScheduleEffects = async (
  c: Context,
  payload: ContentScheduleEffectsPayload,
): Promise<ContentScheduleEffectsOutcome> => {
  const entry = findContentModel(
    c.get("core").contentModels,
    payload.contentTypeId,
  );

  // The plugin went away between the publish and this run. There is nothing
  // left to announce and no definition to announce it with, so this is a dead
  // end rather than a failure - throwing would retry it until the queue gives
  // up, and the record is already correctly published either way.
  if (!entry) {
    await recordContentScheduleEffectsError(
      c.get("db"),
      payload.scheduleId,
      `Content type "${payload.contentTypeId}" is no longer registered, so its scheduled ${payload.operation} was never announced.`,
    );

    return { status: "unregistered" };
  }

  const { definition } = entry.model;
  const row = reviveDates(definition, payload.row);

  const outcome: ContentEditorialOutcome<AnyContentTypeDefinition> = {
    changed: true,
    changedFields: payload.changedFields,
    operation: payload.operation,
    previousSlug: payload.previousSlug,
    restoredFromRevisionId: null,
    revisionId: payload.revisionId,
    row: row as never,
    version: payload.version,
  };

  // The same helper the interactive routes use, so a scheduled publish and a
  // clicked one are indistinguishable to every listener and to the index.
  const { search } = await contentEditorialEffects(c, definition, outcome, {
    pluginId: payload.pluginId,
    scheduledBy: payload.scheduledBy,
  });

  const currentSlug = definition.publicApi.enabled
    ? row[definition.publicApi.slugField]
    : undefined;

  const revalidation = await dispatchContentRevalidation(c, {
    contentTypeId: definition.id,
    id: payload.itemId,
    isPublic: isContentRowPublic(row),
    mode: "immediate",
    // Both, because a transition that moved the URL has to expire the one it
    // used to answer to as well.
    slugs: [
      ...new Set(
        [payload.previousSlug, currentSlug].filter(
          (slug): slug is string => typeof slug === "string" && slug !== "",
        ),
      ),
    ],
    wasPublic: payload.wasPublic,
  });

  const failures: string[] = [];
  if (search?.error) failures.push(`search: ${search.error.message}`);
  // `attempted: 0` is "there was nothing to tell" - no tags, or no web origin
  // configured - which is a decision, not an outage.
  if (revalidation.attempted > 0 && revalidation.delivered === 0) {
    failures.push(
      `cache: none of the ${revalidation.attempted} configured web origin(s) accepted the invalidation`,
    );
  }

  const error = failures.length > 0 ? failures.join("; ") : null;
  await recordContentScheduleEffectsError(
    c.get("db"),
    payload.scheduleId,
    error,
  );

  if (error) {
    // Thrown so the queue's own backoff retries *this* - never the publish.
    throw new Error(
      `Scheduled ${payload.operation} of ${payload.contentTypeId}#${payload.itemId} committed, but its effects did not (${error}).`,
    );
  }

  return { status: "delivered" };
};
