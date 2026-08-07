import type { Context } from "hono";

import { z } from "zod";

import type { ContentLocaleInvalidation } from "../cache";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentEditorialOutcome } from "./editorial-service";
import type { AnyContentModel } from "./model";

import {
  contentLocaleInvalidations,
  diffContentPublicLocaleStates,
} from "../cache";
import { CONTENT_SCHEDULE_ACTIONS } from "../const";
import { contentEditorialEffects } from "./editorial-effects";
import { findContentModel } from "./model";
import { contentPublicLocaleStates } from "./public-locales";
import { dispatchContentRevalidation } from "./revalidate-bridge";
import { recordContentScheduleEffectsError } from "./schedules-model";
import { isContentRowPublic } from "./search-document";

/**
 * The per-locale cache work one scheduled transition owes.
 *
 * Taken as a before-and-after pair rather than reasoned about, because the two
 * differ only in the *base* row's publication state and every locale's answer
 * follows from that plus its own translation - which is exactly what
 * `contentPublicLocaleStates` already computes. Synthesising the previous base
 * state is safe here in a way it would not be generally: a publish or unpublish
 * writes no field values, so nothing else about the row moved.
 */
const scheduledLocales = async (
  c: Context,
  model: AnyContentModel,
  payload: ContentScheduleEffectsPayload,
  row: Record<string, unknown>,
): Promise<ContentLocaleInvalidation[]> => {
  const after = await contentPublicLocaleStates(c, model, payload.itemId, {
    row,
  });
  const before = await contentPublicLocaleStates(c, model, payload.itemId, {
    row: {
      ...row,
      // `publishedAt` only has to be a past instant for the predicate; the real
      // one is on the row when it was public, and irrelevant when it was not.
      publishedAt: payload.wasPublic ? (row.publishedAt ?? new Date(0)) : null,
      status: payload.wasPublic ? "published" : "draft",
    },
  });

  return contentLocaleInvalidations({
    changed: "shared",
    defaultLocale: model.definition.localization.defaultLocale,
    fallback: model.definition.localization.fallback,
    states: diffContentPublicLocaleStates(before, after),
  });
};

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
 * **All three have to land.** A failed event, a refused search write and a web
 * origin that did not accept its invalidation are each enough to fail the run,
 * and the reasons are combined into one `effectsError` so the AdminCP shows
 * everything outstanding rather than whichever failed first.
 *
 * **Delivery is at-least-once.** A retry after a partial failure re-emits the
 * event and re-writes the search document. Both of the latter are idempotent by
 * construction - a search upsert and a cache expiry are the same operation
 * however many times they run - but an event listener may see the same
 * `published` twice, so a listener that must act once keys off the
 * `scheduleId` the payload carries. There is no outbox and no exactly-once
 * claim.
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
  const { event, search, searchByLocale } = await contentEditorialEffects(
    c,
    definition,
    outcome,
    {
      // How a localized record is enumerated into one document per published
      // translation. The queue handler has the model because it looked the
      // content type up to get here.
      model: entry.model,
      // The content type's owner, not core - core only owns the queue handler
      // that happens to be running. `entry.pluginId` is the same value the
      // executor froze into the payload, and both are read back rather than
      // taken from `c.get("plugin")`, which says `@vitnode/core` here.
      pluginId: payload.pluginId,
      scheduledBy: payload.scheduledBy,
      scheduleId: payload.scheduleId,
    },
  );

  const currentSlug = definition.publicApi.enabled
    ? row[definition.publicApi.slugField]
    : undefined;

  const revalidation = await dispatchContentRevalidation(c, {
    contentTypeId: definition.id,
    id: payload.itemId,
    isPublic: isContentRowPublic(row),
    // A scheduled transition moves the *record*, and the record's publication
    // state gates every language - so every locale that had a page, or has one
    // now, is expired. Absent for a content type that is not localized, which
    // leaves the flat fields below as the whole input, exactly as before.
    ...(definition.localization.enabled && definition.publicApi.enabled
      ? { locales: await scheduledLocales(c, entry.model, payload, row) }
      : {}),
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

  // `EventsModel.emit` never throws, so this is the only place a dead listener
  // or a broker outage is visible. Ignoring it would mean an announcement that
  // nobody received counts as delivered and is never retried.
  if (event && event.failures.length > 0) {
    failures.push(
      `event: ${event.failures
        .map(
          failure =>
            `${failure.pluginId}:${failure.module}:${failure.listener} (${failure.error})`,
        )
        .join(", ")}`,
    );
  }

  if (search?.error) failures.push(`search: ${search.error.message}`);

  // One outcome per language on a localized content type, and one failure there
  // is enough to fail the run: a document that was not written is a record that
  // is missing from search in that language until the next rebuild.
  for (const outcome of searchByLocale ?? []) {
    if (outcome.error) {
      failures.push(`search (${outcome.documentId}): ${outcome.error.message}`);
    }
  }

  // Every configured origin has to accept it. A partial delivery is the
  // dangerous case, not the acceptable one: with two web apps behind one API,
  // one of them accepting an unpublish while the other does not leaves the
  // withdrawn page cached and readable, and "at least one worked" would call
  // that a success and never try the other again.
  //
  // `attempted: 0` is different - it means there was nothing to tell, because
  // no tag needed expiring or no web origin is configured. That is a decision
  // somebody made, not an outage.
  if (
    revalidation.attempted > 0 &&
    revalidation.delivered < revalidation.attempted
  ) {
    failures.push(
      `cache: ${revalidation.delivered}/${revalidation.attempted} web origins accepted the invalidation`,
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
