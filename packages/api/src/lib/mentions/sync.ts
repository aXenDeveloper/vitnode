import type { Context } from "hono";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { RichTextNode } from "@/content/rich-text/document";
import type { EnvVitNode } from "@/middlewares/global.middleware";

import { richTextMentionsOf } from "@/content/rich-text/mentions";
import { core_mentions } from "@/database/mentions";
import { mentionCreatedEvent, mentionRemovedEvent } from "@/events/mentions";
import { loadMentionedUsers } from "@/models/mentions/users";
import { detachNotificationEvents } from "@/models/notifications/inbox";

import type { MentionTargetDefinition } from "./targets";

import { mentionNotification } from "./notification";
import { mentionPolicyOfUserId } from "./policy";
import { findMentionTarget } from "./targets";

/** Most mentioned members one target stores; the rest are ignored. */
const MENTIONS_PER_TARGET_MAX = 1000;

export interface SyncMentionsArgs {
  /** Who wrote the text: their roles decide whether and how many members it notifies. */
  actorId: null | number;
  c: Context<EnvVitNode>;
  /** The target's current rich text - every field that can mention, in reading order. */
  documents: readonly (null | RichTextNode | undefined)[];
  /** Members not to notify, e.g. those another notification about the same write already reached. */
  exclude?: readonly number[];
  /** The target's id, as its `access` reads it. */
  id: number | string;
  /** The plugin that registered the target. */
  pluginId: string;
  /** The thread the target belongs to; mentions in one thread group in the inbox. */
  rootId?: null | number | string;
  /** The registered target, or its `type`. */
  target: MentionTargetDefinition | string;
  /** Plain-text title shown in the notification. */
  title: string;
  /** Same-site path the notification opens, `null` for none. */
  url: null | string;
}

export interface SyncMentionsResult {
  /** Members mentioned for the first time. */
  added: number[];
  /** The added members who were notified. */
  notified: number[];
  /** Members no longer mentioned; their notifications are retracted. */
  removed: number[];
}

/**
 * Makes the stored mentions of a target mirror its current text: members
 * mentioned for the first time are stored and - when the author's role may
 * mention and they can read the target - notified with `core.mention`, up to
 * the role's per-item cap; members no longer mentioned lose the mention and
 * its notification. Idempotent: calling it again with the same text changes
 * nothing. Call it after every committed write of the text, outside the
 * write's transaction. Server-only.
 *
 * @example
 * ```ts
 * import { syncMentions } from "@vitnode/api/mentions";
 *
 * await syncMentions({
 *   c,
 *   pluginId: "@vitnode/newsroom",
 *   target: letterMentionTarget,
 *   id: letter.id,
 *   actorId: letter.authorId,
 *   documents: [letter.content],
 *   title: letter.title,
 *   url: `/letters/${letter.id}`,
 * });
 * ```
 *
 * @throws {Error} When the target is not registered by `pluginId`.
 */
export const syncMentions = async ({
  actorId,
  c,
  documents,
  exclude = [],
  id,
  pluginId,
  rootId = null,
  target,
  title,
  url,
}: SyncMentionsArgs): Promise<SyncMentionsResult> => {
  const targetType = typeof target === "string" ? target : target.type;
  const registered = findMentionTarget(c.get("core").mentions, {
    pluginId,
    type: targetType,
  });
  if (!registered) {
    throw new Error(
      `[Mentions] Target "${targetType}" is not registered by ${pluginId}.`,
    );
  }

  const targetId = String(id);
  const root = rootId === null ? null : String(rootId);
  const mentioned = richTextMentionsOf(...documents)
    .map(mention => mention.id)
    .filter(userId => userId !== actorId)
    .slice(0, MENTIONS_PER_TARGET_MAX);
  const existing = new Set(
    (await loadMentionedUsers(c, mentioned)).map(user => user.id),
  );
  const wanted = mentioned.filter(userId => existing.has(userId));
  const policy = await mentionPolicyOfUserId(c, actorId);

  const ofTarget = and(
    eq(core_mentions.pluginId, pluginId),
    eq(core_mentions.targetType, targetType),
    eq(core_mentions.targetId, targetId),
  );

  const outcome = await c.get("db").transaction(async tx => {
    // Two saves of one target must not both see a member as new.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`mentions:${pluginId}:${targetType}:${targetId}`}))`,
    );

    const stored = await tx
      .select({
        eventId: core_mentions.eventId,
        notified: core_mentions.notified,
        userId: core_mentions.userId,
      })
      .from(core_mentions)
      .where(ofTarget);
    const storedIds = new Set(stored.map(row => row.userId));
    const wantedIds = new Set(wanted);

    const gone = stored.filter(row => !wantedIds.has(row.userId));
    if (gone.length > 0) {
      await tx.delete(core_mentions).where(
        and(
          ofTarget,
          inArray(
            core_mentions.userId,
            gone.map(row => row.userId),
          ),
        ),
      );
    }

    const fresh = wanted.filter(userId => !storedIds.has(userId));
    const inserted =
      fresh.length === 0
        ? []
        : await tx
            .insert(core_mentions)
            .values(
              fresh.map(userId => ({
                actorId,
                pluginId,
                targetId,
                targetType,
                userId,
              })),
            )
            .onConflictDoNothing()
            .returning({ id: core_mentions.id, userId: core_mentions.userId });

    const notified: number[] = [];
    if (inserted.length > 0 && policy.canMention) {
      const kept = stored.filter(
        row => row.notified && wantedIds.has(row.userId),
      ).length;
      const room =
        policy.maxPerItem === null
          ? Infinity
          : Math.max(policy.maxPerItem - kept, 0);
      const skipped = new Set(exclude);
      const readers = new Set(
        await registered.definition.access({
          c,
          id: targetId,
          rootId: root,
          userIds: inserted
            .map(row => row.userId)
            .filter(userId => !skipped.has(userId)),
        }),
      );
      const rowOf = new Map(inserted.map(row => [row.userId, row]));
      const chosen = fresh
        .filter(userId => readers.has(userId) && rowOf.has(userId))
        .slice(0, room === Infinity ? undefined : room);

      for (const userId of chosen) {
        const row = rowOf.get(userId);
        if (!row) continue;

        const { eventId } = await c.get("notifications").publish({
          actorId,
          data: {
            mentionId: row.id,
            pluginId,
            rootId: root,
            targetId,
            targetType,
            title,
            url,
          },
          idempotencyKey: `mention:${row.id}`,
          recipients: [userId],
          subject: { id: targetId, type: targetType },
          tx,
          type: mentionNotification,
        });
        await tx
          .update(core_mentions)
          .set({ eventId, notified: true })
          .where(eq(core_mentions.id, row.id));
        notified.push(userId);
      }
    }

    return {
      added: inserted.map(row => row.userId),
      gone,
      notified,
    };
  });
  // Delivers right away, also from a queue task, which has no response to
  // flush after.
  if (outcome.notified.length > 0) c.get("notifications").flushAfterResponse();

  const retracted = outcome.gone.flatMap(row =>
    row.eventId === null ? [] : [row.eventId],
  );
  if (retracted.length > 0) {
    await detachNotificationEvents(c, retracted);
  }

  const base = { actorId, pluginId, targetId, targetType };
  const notifiedIds = new Set(outcome.notified);
  if (outcome.added.length > 0) {
    await c.get("events").emit(mentionCreatedEvent, {
      ...base,
      users: outcome.added.map(userId => ({
        id: userId,
        notified: notifiedIds.has(userId),
      })),
    });
  }
  const removed = outcome.gone.map(row => row.userId);
  if (removed.length > 0) {
    await c
      .get("events")
      .emit(mentionRemovedEvent, { ...base, userIds: removed });
  }

  return { added: outcome.added, notified: outcome.notified, removed };
};

/**
 * Forgets every mention of a target and retracts their notifications - for
 * a target that was deleted. Server-only.
 */
export const deleteMentions = async ({
  c,
  id,
  pluginId,
  targetType,
}: {
  c: Context<EnvVitNode>;
  id: number | string;
  pluginId: string;
  targetType: string;
}): Promise<void> => {
  const rows = await c
    .get("db")
    .delete(core_mentions)
    .where(
      and(
        eq(core_mentions.pluginId, pluginId),
        eq(core_mentions.targetType, targetType),
        eq(core_mentions.targetId, String(id)),
      ),
    )
    .returning({ eventId: core_mentions.eventId });

  const eventIds = rows.flatMap(row =>
    row.eventId === null ? [] : [row.eventId],
  );
  if (eventIds.length > 0) await detachNotificationEvents(c, eventIds);
};
