import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { EnvVitNode } from "../../../api/middlewares/global.middleware";
import type { AnyContentTypeDefinition } from "../../types";
import type {
  ContentModerationDecision,
  ContentNotificationRuntimeContext,
  ContentThreadNotificationData,
} from "./define";
import type { ContentNotificationIntent } from "./intents";
import type { RegisteredContentNotificationRule } from "./registry";

import { detachNotificationEvents } from "../../../api/models/notifications/inbox";
import { core_content_submissions } from "../../../database/content-submissions";
import { core_notification_events } from "../../../database/notifications";
import { contentIdFromKey } from "../../ids";
import { contentDefinitionOf, findContentModel } from "../model";
import { isContentBaseRowPublic } from "../visibility";
import { readContentNotificationRow } from "./access";
import { contentNotificationText } from "./define";
import {
  contentNotificationIntentSchema,
  contentNotificationRegistryOf,
} from "./intents";

export const CONTENT_NOTIFICATIONS_LOG_PREFIX = "[content-notifications]";

type Row = Record<string, unknown>;

/** What one intent came to - for logs and tests. */
export type ContentNotificationOutcome =
  | { published: number; status: "processed" }
  | {
      reason:
        | "gone"
        | "invalid"
        | "no_rules"
        | "not_public"
        | "stale_decision"
        | "unregistered";
      status: "skipped";
    }
  | { removed: number; status: "cleaned"; updated: number };

interface Publication {
  actorId: null | number;
  allowSelf: boolean;
  data: unknown;
  idempotencyKey: string;
  recipients: number[];
  subject?: { id: string; type: string };
  type: string;
}

const userIdOf = (value: unknown): null | number =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;

const keyOf = (value: unknown): null | string =>
  typeof value === "number" || typeof value === "string" ? String(value) : null;

const titleFieldOf = (
  definition: AnyContentTypeDefinition | null,
  row: null | Row,
): string =>
  definition?.admin.titleField && row
    ? contentNotificationText(row[definition.admin.titleField])
    : "";

const recipientsFrom = (
  ids: readonly (null | number | undefined)[],
  exclude: readonly (null | number)[],
): number[] => [
  ...new Set(
    ids
      .map(userIdOf)
      .filter((id): id is number => id !== null && !exclude.includes(id)),
  ),
];

const warn = async (c: Context<EnvVitNode>, message: string) => {
  await c.get("log").warn(`${CONTENT_NOTIFICATIONS_LOG_PREFIX} ${message}`);
};

const threadPublications = (
  entry: Extract<
    RegisteredContentNotificationRule["rule"],
    { kind: "threadReply" }
  >,
  {
    actorId,
    content,
    contentTypeId,
    parent,
    root,
    rootDefinition,
  }: {
    actorId: null | number;
    content: Row;
    contentTypeId: string;
    parent: null | Row;
    root: null | Row;
    rootDefinition: AnyContentTypeDefinition | null;
  },
): Publication[] => {
  if (!root) return [];
  const itemKey = String(content.id);
  const author = userIdOf(content[entry.authorField]);
  // The author wrote it, and whoever published it knows: neither hears about it.
  const exclude = [author, actorId];
  const parentAuthor =
    entry.parentAuthor && parent ? userIdOf(parent[entry.authorField]) : null;
  const rootAuthor = entry.rootAuthorField
    ? userIdOf(root[entry.rootAuthorField])
    : null;

  const reply = recipientsFrom([parentAuthor], exclude);
  // A member who qualifies both ways gets the reply only.
  const comment = recipientsFrom([rootAuthor], [...exclude, ...reply]);
  const base = {
    contentId: itemKey,
    contentTypeId,
    parentId: parent ? String(parent.id) : null,
    rootId: String(root.id),
    target: entry.target({ content, parent, root }),
    title: contentNotificationText(
      entry.title
        ? entry.title({ content, root })
        : titleFieldOf(rootDefinition, root),
    ),
  } satisfies Omit<ContentThreadNotificationData, "relation">;

  return (
    [
      ["reply", reply],
      ["comment", comment],
    ] as const
  )
    .filter(([, recipients]) => recipients.length > 0)
    .map(([relation, recipients]) => ({
      // The comment's author is who the item shows - not the moderator who
      // approved it.
      actorId: author,
      allowSelf: false,
      data: { ...base, relation } satisfies ContentThreadNotificationData,
      idempotencyKey: `first-publication:${contentTypeId}:${itemKey}:${relation}`,
      recipients,
      subject: { id: itemKey, type: contentTypeId },
      type: entry.type.id,
    }));
};

const loadDecision = async (
  c: Context<EnvVitNode>,
  intent: Extract<ContentNotificationIntent, { trigger: "moderationDecision" }>,
): Promise<ContentModerationDecision | null> => {
  const [submission] = await c
    .get("db")
    .select()
    .from(core_content_submissions)
    .where(eq(core_content_submissions.id, intent.submissionId))
    .limit(1);
  if (
    !submission ||
    submission.status !== intent.decision ||
    submission.contentTypeId !== intent.contentTypeId ||
    submission.itemId !== intent.itemId
  ) {
    return null;
  }

  return {
    authorId: submission.authorId,
    kind: submission.kind,
    reason: submission.status === "rejected" ? submission.reason : null,
    reviewerId: submission.reviewerId,
    status: intent.decision,
    submissionId: submission.id,
  };
};

const cleanUp = async (
  c: Context<EnvVitNode>,
  intent: Extract<ContentNotificationIntent, { trigger: "deleted" }>,
): Promise<ContentNotificationOutcome> => {
  const registry = contentNotificationRegistryOf(c);
  const entries = registry?.list ?? [];
  const asContent = entries
    .filter(entry => entry.config.content.id === intent.contentTypeId)
    .map(entry => entry.rule.type.id);
  const asRoot = entries
    .filter(entry => entry.config.root?.id === intent.contentTypeId)
    .map(entry => entry.rule.type.id);

  const ids = new Set<number>();
  const db = c.get("db");
  if (asContent.length > 0) {
    const rows = await db
      .select({ id: core_notification_events.id })
      .from(core_notification_events)
      .where(
        and(
          inArray(core_notification_events.type, asContent),
          eq(core_notification_events.subjectType, intent.contentTypeId),
          eq(core_notification_events.subjectId, intent.itemId),
        ),
      );
    for (const row of rows) ids.add(row.id);
  }
  if (asRoot.length > 0) {
    // Replies to a deleted root go with it - by a cascade that runs no
    // service code, so they are found through the root they point at.
    const rows = await db
      .select({ id: core_notification_events.id })
      .from(core_notification_events)
      .where(
        and(
          inArray(core_notification_events.type, asRoot),
          sql`${core_notification_events.data}->>'rootId' = ${intent.itemId}`,
        ),
      );
    for (const row of rows) ids.add(row.id);
  }

  const result = await detachNotificationEvents(c, [...ids]);

  return { ...result, status: "cleaned" };
};

/**
 * Processes one stored intent: reloads the records, checks they are still
 * eligible, resolves recipients and publishes through the core notification
 * system. Safe to run more than once - every publication carries a key
 * derived from the operation, so a retry finds the event it already stored.
 */
export const processContentNotificationIntent = async (
  c: Context<EnvVitNode>,
  payload: unknown,
): Promise<ContentNotificationOutcome> => {
  const parsed = contentNotificationIntentSchema.safeParse(payload);
  if (!parsed.success) {
    await warn(c, `Dropped an unreadable intent: ${parsed.error.message}`);

    return { reason: "invalid", status: "skipped" };
  }
  const intent = parsed.data;
  if (intent.trigger === "deleted") return await cleanUp(c, intent);

  const registry = contentNotificationRegistryOf(c);
  const rules = intent.ruleIds.flatMap(id => {
    const entry = registry?.get(id);

    return entry &&
      entry.config.content.id === intent.contentTypeId &&
      entry.rule.on === intent.trigger
      ? [entry]
      : [];
  });
  if (rules.length < intent.ruleIds.length) {
    const missing = intent.ruleIds.filter(
      id => !rules.some(entry => entry.rule.type.id === id),
    );
    await warn(
      c,
      `Rules ${missing.join(", ")} of "${intent.contentTypeId}" are no longer registered; ${intent.trigger} of ${intent.itemId} skips them.`,
    );
  }
  if (rules.length === 0) return { reason: "no_rules", status: "skipped" };

  const entry = findContentModel(
    c.get("core").contentModels,
    intent.contentTypeId,
  );
  if (!entry) {
    await warn(c, `"${intent.contentTypeId}" is no longer registered.`);

    return { reason: "unregistered", status: "skipped" };
  }
  const definition = contentDefinitionOf(entry.model);

  const content = await readContentNotificationRow(
    c,
    intent.contentTypeId,
    intent.itemId,
  );
  if (!content) return { reason: "gone", status: "skipped" };
  // Checked again here, not trusted from the operation: a record hidden or
  // unpublished since then is not announced.
  if (
    intent.trigger === "firstPublication" &&
    !isContentBaseRowPublic(content)
  ) {
    return { reason: "not_public", status: "skipped" };
  }

  const decision =
    intent.trigger === "moderationDecision"
      ? await loadDecision(c, intent)
      : null;
  if (intent.trigger === "moderationDecision" && !decision) {
    return { reason: "stale_decision", status: "skipped" };
  }

  const rootDefinition =
    rules.find(entry => entry.config.root)?.config.root ?? null;
  const rootKey =
    definition.thread.enabled && rootDefinition
      ? keyOf(content[definition.thread.rootField])
      : null;
  const parentKey = definition.thread.enabled
    ? keyOf(content[definition.thread.parentField])
    : null;
  const [root, parent] = await Promise.all([
    rootKey && rootDefinition
      ? readContentNotificationRow(c, rootDefinition.id, rootKey)
      : null,
    parentKey ? readContentNotificationRow(c, definition.id, parentKey) : null,
  ]);
  if (
    intent.trigger === "firstPublication" &&
    root &&
    !isContentBaseRowPublic(root)
  ) {
    return { reason: "not_public", status: "skipped" };
  }

  const itemKey = intent.itemId;
  const operationKey =
    intent.trigger === "moderationDecision"
      ? `decision:${intent.contentTypeId}:${intent.submissionId}`
      : `first-publication:${intent.contentTypeId}:${itemKey}`;
  const context: ContentNotificationRuntimeContext = {
    actorId: intent.actorId,
    c,
    content,
    contentTypeId: intent.contentTypeId,
    decision,
    parent,
    root,
    trigger: intent.trigger,
  };

  // Plugin callbacks run here, before the transaction: they may read, and a
  // slow one must not hold locks.
  const publications: Publication[] = [];
  for (const { rule } of rules) {
    if (rule.kind === "threadReply") {
      publications.push(
        ...threadPublications(rule, {
          actorId: intent.actorId,
          content,
          contentTypeId: intent.contentTypeId,
          parent,
          root,
          rootDefinition,
        }),
      );
    } else if (rule.kind === "moderationDecision" && decision) {
      const recipients = recipientsFrom([decision.authorId], [intent.actorId]);
      if (recipients.length === 0) continue;
      publications.push({
        // Decisions stay anonymous: the item names no moderator.
        actorId: null,
        allowSelf: false,
        data: {
          contentId: itemKey,
          contentTypeId: intent.contentTypeId,
          decision: decision.status,
          kind: decision.kind,
          reason: decision.reason,
          rootId: root ? String(root.id) : null,
          submissionId: decision.submissionId,
          target: rule.target({ content, decision, root }),
          title: contentNotificationText(
            rule.title
              ? rule.title({ content, root })
              : titleFieldOf(rootDefinition, root) ||
                  titleFieldOf(definition, content),
          ),
        },
        idempotencyKey: operationKey,
        recipients,
        subject: { id: itemKey, type: intent.contentTypeId },
        type: rule.type.id,
      });
    } else if (rule.kind === "custom") {
      const candidates = await rule.recipients(context);
      const recipients = recipientsFrom(
        candidates,
        rule.allowSelf ? [] : [intent.actorId],
      );
      if (recipients.length === 0) continue;
      const subjectType = rule.type.subjectType;
      publications.push({
        actorId: intent.actorId,
        allowSelf: rule.allowSelf,
        data: rule.data(context),
        idempotencyKey: operationKey,
        recipients,
        ...(subjectType === undefined || subjectType === intent.contentTypeId
          ? { subject: { id: itemKey, type: intent.contentTypeId } }
          : {}),
        type: rule.type.id,
      });
    }
  }
  if (publications.length === 0) return { published: 0, status: "processed" };

  const model = entry.model;
  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTable = model.table;
  const id = contentIdFromKey(definition.idStrategy, itemKey);

  const published = await c.get("db").transaction(async tx => {
    // Holds off a delete until the events exist, so its cleanup sees them.
    const [locked] = await tx
      .select({ id: columns.id })
      .from(table)
      .where(eq(columns.id, id))
      .limit(1)
      .for("share");
    if (!locked) return 0;

    // One transaction for every recipient group: all of the operation's
    // events commit together, or none do and the retry starts clean.
    for (const publication of publications) {
      await c.get("notifications").publish({ ...publication, tx });
    }

    return publications.length;
  });

  c.get("notifications").flushAfterResponse();

  return published === 0
    ? { reason: "gone", status: "skipped" }
    : { published, status: "processed" };
};
