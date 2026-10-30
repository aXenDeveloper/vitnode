import type { Context } from "hono";

import { and, eq, gt, isNull, or } from "drizzle-orm";

import { core_moderation_sanctions } from "@/database/warnings";
import { isSanctionActiveAt } from "@/lib/moderation/warnings";

/** The suspension that keeps an account restricted right now. */
export interface ActiveSuspension {
  /** The latest end among active suspensions; `null` while any is indefinite. */
  endsAt: Date | null;
  sanctionIds: number[];
}

interface CachedSanction {
  endsAt: null | string;
  id: number;
  startsAt: string;
}

/** Positive and negative answers both live this long, unless revoked sooner. */
const SUSPENSION_CACHE_TTL_SECONDS = 60;

const suspensionCacheKey = (userId: number): string =>
  `moderation:suspension:${userId}`;

const loadSuspensions = async (
  c: Context,
  userId: number,
  now: Date,
): Promise<CachedSanction[]> => {
  const table = core_moderation_sanctions;
  const rows = await c
    .get("db")
    .select({
      endsAt: table.endsAt,
      id: table.id,
      startsAt: table.startsAt,
    })
    .from(table)
    .where(
      and(
        eq(table.userId, userId),
        eq(table.type, "suspension"),
        isNull(table.revokedAt),
        or(isNull(table.endsAt), gt(table.endsAt, now)),
      ),
    );

  return rows.map(row => ({
    endsAt: row.endsAt?.toISOString() ?? null,
    id: row.id,
    startsAt: row.startsAt.toISOString(),
  }));
};

/**
 * The account's active suspension at server time, or `null`. Each sanction is
 * re-checked against its own timestamps on every call, so a temporary one
 * stops applying the moment it ends - no scheduled job involved. Cached per
 * user for a minute and dropped by {@link forgetSuspension} whenever a
 * sanction is applied or revoked. Server-only.
 */
export const findActiveSuspension = async (
  c: Context,
  userId: number,
  now: Date = new Date(),
): Promise<ActiveSuspension | null> => {
  const cache = c.get("cache");
  const key = suspensionCacheKey(userId);
  let sanctions = await cache.getSystem<CachedSanction[]>(key);
  if (!sanctions) {
    sanctions = await loadSuspensions(c, userId, now);
    await cache.setSystem(key, sanctions, SUSPENSION_CACHE_TTL_SECONDS);
  }

  const active = sanctions.filter(sanction =>
    isSanctionActiveAt(
      {
        endsAt: sanction.endsAt ? new Date(sanction.endsAt) : null,
        revokedAt: null,
        startsAt: new Date(sanction.startsAt),
      },
      now,
    ),
  );
  if (active.length === 0) return null;

  const indefinite = active.some(sanction => sanction.endsAt === null);
  const latest = active
    .map(sanction => sanction.endsAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);

  return {
    endsAt: indefinite || !latest ? null : new Date(latest),
    sanctionIds: active.map(sanction => sanction.id),
  };
};

/**
 * Drops the cached suspension state of a user and closes their open
 * WebSocket connections, so a new or revoked sanction applies on the next
 * request on every instance that shares the cache.
 */
export const forgetSuspension = async (
  c: Context,
  userId: number,
  { disconnect }: { disconnect: boolean },
): Promise<void> => {
  await c.get("cache").deleteSystem(suspensionCacheKey(userId));
  if (disconnect) c.get("realtime").closeUserConnections(userId);
};
