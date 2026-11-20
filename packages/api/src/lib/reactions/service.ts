import type { Context } from "hono";

import { and, eq, gte, inArray, sql } from "drizzle-orm";

import type { ContentDatabase } from "@/content/server/service";

import {
  core_reactions_counts,
  core_reactions_counts_version_seq,
  core_reactions_entries,
} from "@/database/reactions";
import { core_users } from "@/database/users";
import {
  reactionAddedEvent,
  reactionChangedEvent,
  reactionRemovedEvent,
  reputationChangedEvent,
} from "@/events/reactions";
import { periodContaining } from "@/lib/ai/periods";
import { reactionReceivedNotification } from "@/lib/notifications/core-types";

import type { ReactionCatalogEntry } from "./catalog";
import type { ReactionViewerPolicy } from "./policy";
import type { ReactionTargetAccess, RegisteredReactionTarget } from "./targets";

import { getReactionCatalog } from "./catalog";
import { publishReactionCounts, revokeReactionRooms } from "./live/publish";
import { resolveReactionPolicy } from "./policy";

/** One target's public counts, as everybody who can read it sees them. */
export interface ReactionCounts {
  counts: { code: string; count: number }[];
  /** Grows with every write to the target; the live channel drops older messages. */
  seq: number;
  total: number;
}

/** One target's reactions for the current visitor. */
export interface ReactionSummary extends ReactionCounts {
  /** A guest gets `true` for a readable, unlocked target - the UI asks them to sign in. */
  canReact: boolean;
  id: string;
  /** Codes the visitor used on this target; `[]` for guests. */
  viewer: string[];
}

/** A refused write, answered by the route with this status and code. */
export type ReactionWriteErrorCode =
  | "daily_limit"
  | "item_limit"
  | "locked"
  | "not_found"
  | "reacting_disabled"
  | "reaction_daily_limit"
  | "reaction_not_allowed"
  | "self_reaction"
  | "sign_in";

export class ReactionWriteError extends Error {
  constructor(
    status: 401 | 403 | 404 | 409 | 429,
    code: ReactionWriteErrorCode,
    resetsAt: Date | null = null,
  ) {
    super(code);
    this.name = "ReactionWriteError";
    this.status = status;
    this.code = code;
    this.resetsAt = resetsAt;
  }

  readonly code: ReactionWriteErrorCode;
  readonly resetsAt: Date | null;
  readonly status: 401 | 403 | 404 | 409 | 429;
}

export interface ReactionTargetRef {
  pluginId: string;
  type: string;
}

const EMPTY_COUNTS: ReactionCounts = { counts: [], seq: 0, total: 0 };

/** Serializes writes to one target until the transaction ends. */
const lockTarget = async (
  tx: ContentDatabase,
  target: ReactionTargetRef,
  id: string,
) => {
  const key = `core_reactions:${target.pluginId}:${target.type}:${id}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
};

const targetWhere = (target: ReactionTargetRef, ids: string[]) =>
  and(
    eq(core_reactions_counts.pluginId, target.pluginId),
    eq(core_reactions_counts.targetType, target.type),
    inArray(core_reactions_counts.targetId, ids),
  );

const entriesWhere = (target: ReactionTargetRef, ids: string[]) =>
  and(
    eq(core_reactions_entries.pluginId, target.pluginId),
    eq(core_reactions_entries.targetType, target.type),
    inArray(core_reactions_entries.targetId, ids),
  );

/** Counts of several targets of one type, keyed by id. Disabled reactions are left out. */
export const readReactionCounts = async (
  db: ContentDatabase,
  catalog: readonly ReactionCatalogEntry[],
  target: ReactionTargetRef,
  ids: string[],
): Promise<Map<string, ReactionCounts>> => {
  const result = new Map<string, ReactionCounts>();
  if (ids.length === 0) return result;

  const rows = await db
    .select({
      count: core_reactions_counts.count,
      reactionId: core_reactions_counts.reactionId,
      targetId: core_reactions_counts.targetId,
      version: core_reactions_counts.version,
    })
    .from(core_reactions_counts)
    .where(targetWhere(target, ids));

  const enabled = new Map(
    catalog
      .filter(reaction => reaction.enabled)
      .map(reaction => [reaction.id, reaction]),
  );

  for (const id of ids) {
    const own = rows.filter(row => row.targetId === id);
    const counts = catalog
      .filter(reaction => enabled.has(reaction.id))
      .flatMap(reaction => {
        const count =
          own.find(row => row.reactionId === reaction.id)?.count ?? 0;

        return count > 0 ? [{ code: reaction.code, count }] : [];
      });

    result.set(id, {
      counts,
      seq: Math.max(0, ...own.map(row => row.version)),
      total: counts.reduce((sum, item) => sum + item.count, 0),
    });
  }

  return result;
};

const canReactOn = (
  c: Context,
  access: ReactionTargetAccess | undefined,
  registered: RegisteredReactionTarget,
  policy: ReactionViewerPolicy,
): boolean => {
  if (!access?.canRead || access.locked) return false;
  const user = c.get("user");
  if (!user) return true;
  if (!policy.canReact) return false;

  return policy.canReactOwnContent || access.authorId !== user.id;
};

/**
 * Reactions of up to `REACTIONS_LIMITS.idsPerRequest` targets of one type for
 * the current visitor, in the order asked. An unreadable id answers like a
 * target nobody reacted to, so a draft and a missing row look the same.
 */
export const readReactionSummaries = async (
  c: Context,
  registered: RegisteredReactionTarget,
  ids: string[],
): Promise<ReactionSummary[]> => {
  if (ids.length === 0) return [];

  const target = {
    pluginId: registered.pluginId,
    type: registered.definition.type,
  };
  const catalog = await getReactionCatalog(c);
  const [access, policy] = await Promise.all([
    registered.definition.access(c, { ids }),
    resolveReactionPolicy(c, catalog),
  ]);
  const readable = ids.filter(id => access.get(id)?.canRead);
  const user = c.get("user");
  const db = c.get("db");

  const [counts, own] = await Promise.all([
    readReactionCounts(db, catalog, target, readable),
    user && readable.length > 0
      ? db
          .select({
            reactionId: core_reactions_entries.reactionId,
            targetId: core_reactions_entries.targetId,
          })
          .from(core_reactions_entries)
          .where(
            and(
              entriesWhere(target, readable),
              eq(core_reactions_entries.userId, user.id),
            ),
          )
      : Promise.resolve([]),
  ]);
  const codeOf = new Map(
    catalog
      .filter(reaction => reaction.enabled)
      .map(reaction => [reaction.id, reaction.code]),
  );

  return ids.map(id => {
    const targetAccess = access.get(id);
    if (!targetAccess?.canRead) {
      return { ...EMPTY_COUNTS, canReact: false, id, viewer: [] };
    }

    return {
      ...(counts.get(id) ?? EMPTY_COUNTS),
      canReact: canReactOn(c, targetAccess, registered, policy),
      id,
      viewer: own
        .filter(row => row.targetId === id)
        .flatMap(row => {
          const code = codeOf.get(row.reactionId);

          return code ? [code] : [];
        }),
    };
  });
};

const bumpCount = async (
  tx: ContentDatabase,
  target: ReactionTargetRef,
  id: string,
  reactionId: number,
  delta: number,
) => {
  await tx
    .insert(core_reactions_counts)
    .values({
      count: Math.max(delta, 0),
      pluginId: target.pluginId,
      reactionId,
      targetId: id,
      targetType: target.type,
      version: sql`nextval(${core_reactions_counts_version_seq.seqName})`,
    })
    .onConflictDoUpdate({
      set: {
        count: sql`greatest(${core_reactions_counts.count} + ${delta}, 0)`,
        version: sql`nextval(${core_reactions_counts_version_seq.seqName})`,
      },
      target: [
        core_reactions_counts.pluginId,
        core_reactions_counts.targetType,
        core_reactions_counts.targetId,
        core_reactions_counts.reactionId,
      ],
    });
};

const addReputation = async (
  tx: ContentDatabase,
  deltas: Map<number, number>,
): Promise<{ delta: number; total: number; userId: number }[]> => {
  const changed: { delta: number; total: number; userId: number }[] = [];
  for (const [userId, delta] of deltas) {
    if (delta === 0) continue;
    const [row] = await tx
      .update(core_users)
      .set({ reputation: sql`${core_users.reputation} + ${delta}` })
      .where(eq(core_users.id, userId))
      .returning({ total: core_users.reputation });
    if (row) changed.push({ delta, total: row.total, userId });
  }

  return changed;
};

const addTo = (map: Map<number, number>, key: null | number, value: number) => {
  if (key === null) return;
  map.set(key, (map.get(key) ?? 0) + value);
};

interface WriteOutcome {
  added: null | {
    code: string;
    points: number;
    previous: null | string;
    targetAuthorId: null | number;
  };
  counts: ReactionCounts;
  removed: {
    code: string;
    points: number;
    targetAuthorId: null | number;
  }[];
  reputation: { delta: number; total: number; userId: number }[];
}

const runEffects = async (
  c: Context,
  target: ReactionTargetRef,
  id: string,
  userId: number,
  outcome: WriteOutcome,
) => {
  const events = c.get("events");
  const base = {
    pluginId: target.pluginId,
    targetId: id,
    targetType: target.type,
    userId,
  };

  if (outcome.added?.previous) {
    await events.emit(reactionChangedEvent, {
      ...base,
      points: outcome.added.points,
      previousReaction: outcome.added.previous,
      reaction: outcome.added.code,
      targetAuthorId: outcome.added.targetAuthorId,
    });
  } else {
    for (const removed of outcome.removed) {
      await events.emit(reactionRemovedEvent, {
        ...base,
        points: removed.points,
        reaction: removed.code,
        targetAuthorId: removed.targetAuthorId,
      });
    }
    if (outcome.added) {
      await events.emit(reactionAddedEvent, {
        ...base,
        points: outcome.added.points,
        reaction: outcome.added.code,
        targetAuthorId: outcome.added.targetAuthorId,
      });
    }
  }

  for (const change of outcome.reputation) {
    await events.emit(reputationChangedEvent, {
      ...change,
      reason: "reaction",
    });
  }

  publishReactionCounts({ ...target, id }, outcome.counts);
};

const findAccess = async (
  c: Context,
  registered: RegisteredReactionTarget,
  id: string,
): Promise<ReactionTargetAccess> => {
  const access = (await registered.definition.access(c, { ids: [id] })).get(id);
  if (!access?.canRead) throw new ReactionWriteError(404, "not_found");

  return access;
};

const viewerCodes = async (
  c: Context,
  target: ReactionTargetRef,
  id: string,
  catalog: readonly ReactionCatalogEntry[],
): Promise<string[]> => {
  const user = c.get("user");
  if (!user) return [];
  const rows = await c
    .get("db")
    .select({ reactionId: core_reactions_entries.reactionId })
    .from(core_reactions_entries)
    .where(
      and(
        entriesWhere(target, [id]),
        eq(core_reactions_entries.userId, user.id),
      ),
    );
  const codeOf = new Map(
    catalog.filter(item => item.enabled).map(item => [item.id, item.code]),
  );

  return rows.flatMap(row => {
    const code = codeOf.get(row.reactionId);

    return code ? [code] : [];
  });
};

/** Tells the author someone reacted. Never fails the reaction. */
const notifyReactionReceived = async (
  c: Context,
  registered: RegisteredReactionTarget,
  {
    actorId,
    authorId,
    code,
    id,
  }: { actorId: number; authorId: number; code: string; id: string },
): Promise<void> => {
  try {
    const preview = (
      await registered.definition.preview?.(c, { ids: [id] })
    )?.get(id);
    await c.get("notifications").publish({
      actorId,
      data: {
        pluginId: registered.pluginId,
        reaction: code,
        targetId: id,
        targetType: registered.definition.type,
        title: preview?.title ?? "",
        url: preview?.url ?? null,
      },
      idempotencyKey: `reaction:${registered.pluginId}:${registered.definition.type}:${id}:${actorId}:${code}`,
      recipients: [authorId],
      type: reactionReceivedNotification,
    });
  } catch (error) {
    await c
      .get("log")
      ?.error(
        `[reactions] The reaction notification was not sent (${error instanceof Error ? error.message : String(error)}).`,
      );
  }
};

/**
 * Adds the signed-in member's reaction `code` to one target, inside one
 * transaction that serializes writes to the target and to the member: role
 * policy, per-item cap (at `1` a new pick replaces the old one), daily limits,
 * counts and the author's reputation. Idempotent. Side effects (events, live
 * counts) run after the commit. Server-only.
 *
 * @throws {ReactionWriteError} When the write is refused.
 */
export const addReaction = async (
  c: Context,
  registered: RegisteredReactionTarget,
  { code, id }: { code: string; id: string },
): Promise<ReactionSummary> => {
  const user = c.get("user");
  if (!user) throw new ReactionWriteError(401, "sign_in");

  const catalog = await getReactionCatalog(c);
  const reaction = catalog.find(item => item.code === code && item.enabled);
  if (!reaction) throw new ReactionWriteError(404, "not_found");

  const policy = await resolveReactionPolicy(c, catalog);
  if (!policy.canReact) throw new ReactionWriteError(403, "reacting_disabled");
  const reactionLimit = policy.reactions.get(reaction.id);
  if (!reactionLimit) throw new ReactionWriteError(403, "reaction_not_allowed");

  const access = await findAccess(c, registered, id);
  if (access.locked) throw new ReactionWriteError(403, "locked");
  const { definition } = registered;
  const isAuthor = access.authorId === user.id;
  if (isAuthor && !policy.canReactOwnContent) {
    throw new ReactionWriteError(403, "self_reaction");
  }

  const target = { pluginId: registered.pluginId, type: definition.type };
  const targetAuthorId =
    definition.reputation === false || isAuthor ? null : access.authorId;
  const pointsOf = new Map(catalog.map(item => [item.id, item.points]));
  const codeOf = new Map(catalog.map(item => [item.id, item.code]));
  const day = periodContaining(new Date(), "day", user.timeZone ?? "UTC");

  const outcome = await c.get("db").transaction(async (tx: ContentDatabase) => {
    await lockTarget(tx, target, id);
    await tx
      .select({ id: core_users.id })
      .from(core_users)
      .where(eq(core_users.id, user.id))
      .for("update");

    const mine = await tx
      .select({
        createdAt: core_reactions_entries.createdAt,
        id: core_reactions_entries.id,
        reactionId: core_reactions_entries.reactionId,
        targetAuthorId: core_reactions_entries.targetAuthorId,
      })
      .from(core_reactions_entries)
      .where(
        and(
          entriesWhere(target, [id]),
          eq(core_reactions_entries.userId, user.id),
        ),
      );

    if (mine.some(row => row.reactionId === reaction.id)) {
      const counts = await readReactionCounts(tx, catalog, target, [id]);

      return {
        added: null,
        counts: counts.get(id) ?? EMPTY_COUNTS,
        removed: [],
        reputation: [],
      } satisfies WriteOutcome;
    }

    let replaced: typeof mine = [];
    if (policy.maxPerItem !== null && mine.length >= policy.maxPerItem) {
      if (policy.maxPerItem !== 1) {
        throw new ReactionWriteError(409, "item_limit");
      }
      replaced = mine;
    }

    const today = await tx
      .select({
        reactionId: core_reactions_entries.reactionId,
        total: sql<number>`count(*)::int`,
      })
      .from(core_reactions_entries)
      .where(
        and(
          eq(core_reactions_entries.userId, user.id),
          gte(core_reactions_entries.createdAt, day.start),
        ),
      )
      .groupBy(core_reactions_entries.reactionId);
    const freed = replaced.filter(row => row.createdAt >= day.start);
    const usedTotal =
      today.reduce((sum, row) => sum + row.total, 0) - freed.length;
    if (policy.totalPerDay !== null && usedTotal + 1 > policy.totalPerDay) {
      throw new ReactionWriteError(429, "daily_limit", day.end);
    }
    const usedThis =
      (today.find(row => row.reactionId === reaction.id)?.total ?? 0) -
      freed.filter(row => row.reactionId === reaction.id).length;
    if (
      reactionLimit.dailyLimit !== null &&
      usedThis + 1 > reactionLimit.dailyLimit
    ) {
      throw new ReactionWriteError(429, "reaction_daily_limit", day.end);
    }

    const deltas = new Map<number, number>();
    if (replaced.length > 0) {
      await tx.delete(core_reactions_entries).where(
        inArray(
          core_reactions_entries.id,
          replaced.map(row => row.id),
        ),
      );
      for (const row of replaced) {
        await bumpCount(tx, target, id, row.reactionId, -1);
        addTo(deltas, row.targetAuthorId, -(pointsOf.get(row.reactionId) ?? 0));
      }
    }

    await tx.insert(core_reactions_entries).values({
      pluginId: target.pluginId,
      reactionId: reaction.id,
      targetAuthorId,
      targetId: id,
      targetType: target.type,
      userId: user.id,
    });
    await bumpCount(tx, target, id, reaction.id, 1);
    addTo(deltas, targetAuthorId, reaction.points);

    const reputation = await addReputation(tx, deltas);
    const counts = await readReactionCounts(tx, catalog, target, [id]);

    return {
      added: {
        code: reaction.code,
        points: reaction.points,
        previous:
          replaced.length === 1
            ? (codeOf.get(replaced[0].reactionId) ?? null)
            : null,
        targetAuthorId,
      },
      counts: counts.get(id) ?? EMPTY_COUNTS,
      removed: replaced.map(row => ({
        code: codeOf.get(row.reactionId) ?? "",
        points: pointsOf.get(row.reactionId) ?? 0,
        targetAuthorId: row.targetAuthorId,
      })),
      reputation,
    } satisfies WriteOutcome;
  });

  if (outcome.added) await runEffects(c, target, id, user.id, outcome);
  if (
    outcome.added &&
    !outcome.added.previous &&
    access.authorId !== null &&
    !isAuthor
  ) {
    await notifyReactionReceived(c, registered, {
      actorId: user.id,
      authorId: access.authorId,
      code: reaction.code,
      id,
    });
  }

  return {
    ...outcome.counts,
    canReact: true,
    id,
    viewer: await viewerCodes(c, target, id, catalog),
  };
};

/**
 * Removes the signed-in member's reaction `code` from one target, or all of
 * theirs without `code`. Never limited. Idempotent. Server-only.
 *
 * @throws {ReactionWriteError} When the visitor is a guest or cannot read the target.
 */
export const removeReaction = async (
  c: Context,
  registered: RegisteredReactionTarget,
  { code, id }: { code?: string; id: string },
): Promise<ReactionSummary> => {
  const user = c.get("user");
  if (!user) throw new ReactionWriteError(401, "sign_in");

  const catalog = await getReactionCatalog(c);
  const access = await findAccess(c, registered, id);
  const policy = await resolveReactionPolicy(c, catalog);
  const target = {
    pluginId: registered.pluginId,
    type: registered.definition.type,
  };
  const reaction = code ? catalog.find(item => item.code === code) : undefined;
  if (code && !reaction) throw new ReactionWriteError(404, "not_found");
  const pointsOf = new Map(catalog.map(item => [item.id, item.points]));
  const codeOf = new Map(catalog.map(item => [item.id, item.code]));

  const outcome = await c.get("db").transaction(async (tx: ContentDatabase) => {
    await lockTarget(tx, target, id);
    const removed = await tx
      .delete(core_reactions_entries)
      .where(
        and(
          entriesWhere(target, [id]),
          eq(core_reactions_entries.userId, user.id),
          ...(reaction
            ? [eq(core_reactions_entries.reactionId, reaction.id)]
            : []),
        ),
      )
      .returning({
        reactionId: core_reactions_entries.reactionId,
        targetAuthorId: core_reactions_entries.targetAuthorId,
      });

    const deltas = new Map<number, number>();
    for (const row of removed) {
      await bumpCount(tx, target, id, row.reactionId, -1);
      addTo(deltas, row.targetAuthorId, -(pointsOf.get(row.reactionId) ?? 0));
    }
    const reputation = await addReputation(tx, deltas);
    const counts = await readReactionCounts(tx, catalog, target, [id]);

    return {
      added: null,
      counts: counts.get(id) ?? EMPTY_COUNTS,
      removed: removed.map(row => ({
        code: codeOf.get(row.reactionId) ?? "",
        points: pointsOf.get(row.reactionId) ?? 0,
        targetAuthorId: row.targetAuthorId,
      })),
      reputation,
    } satisfies WriteOutcome;
  });

  if (outcome.removed.length > 0) {
    await runEffects(c, target, id, user.id, outcome);
  }

  return {
    ...outcome.counts,
    canReact: canReactOn(c, access, registered, policy),
    id,
    viewer: await viewerCodes(c, target, id, catalog),
  };
};

/**
 * Deletes every reaction of the given targets and takes back the reputation
 * they gave, then tells live subscribers the targets are gone. Call it from
 * the delete path of a custom target; Content Engine types call it on their
 * own. Server-only.
 *
 * @example
 * ```ts
 * import { deleteReactions } from "@vitnode/api/reactions";
 *
 * await deleteReactions(c, {
 *   pluginId: manifest.id,
 *   type: "newsroom.correction",
 *   ids: [String(correction.id)],
 * });
 * ```
 */
export const deleteReactions = async (
  c: Context,
  { ids, pluginId, type }: { ids: string[]; pluginId: string; type: string },
): Promise<void> => {
  if (ids.length === 0) return;
  const target = { pluginId, type };
  const catalog = await getReactionCatalog(c);
  const pointsOf = new Map(catalog.map(item => [item.id, item.points]));

  const reputation = await c
    .get("db")
    .transaction(async (tx: ContentDatabase) => {
      const removed = await tx
        .delete(core_reactions_entries)
        .where(entriesWhere(target, ids))
        .returning({
          reactionId: core_reactions_entries.reactionId,
          targetAuthorId: core_reactions_entries.targetAuthorId,
        });
      await tx.delete(core_reactions_counts).where(targetWhere(target, ids));

      const deltas = new Map<number, number>();
      for (const row of removed) {
        addTo(deltas, row.targetAuthorId, -(pointsOf.get(row.reactionId) ?? 0));
      }

      return await addReputation(tx, deltas);
    });

  const events = c.get("events");
  for (const change of reputation) {
    await events.emit(reputationChangedEvent, {
      ...change,
      reason: "reaction",
    });
  }
  revokeReactionRooms(target, ids);
};
