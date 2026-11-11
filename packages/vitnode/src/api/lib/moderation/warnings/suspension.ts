import type { Context } from "hono";

import { and, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { defineCacheEntry } from "@/api/builders";
import { core_moderation_sanctions } from "@/database/warnings";
import { isSanctionActiveAt } from "@/lib/moderation/warnings";

/** The suspension that keeps an account restricted right now. */
export interface ActiveSuspension {
  /** The latest end among active suspensions; `null` while any is indefinite. */
  endsAt: Date | null;
  sanctionIds: number[];
}

/**
 * A user's unrevoked suspensions that had not ended when they were loaded.
 * Positive and negative answers both live a minute, unless revoked sooner.
 */
const suspensionsCache = defineCacheEntry({
  name: "moderation.suspensions",
  version: 1,
  key: (userId: number) => [userId],
  schema: z.array(
    z.object({
      endsAt: z.iso.datetime().nullable(),
      id: z.number().int(),
      startsAt: z.iso.datetime(),
    }),
  ),
  ttlSeconds: 60,
});

const loadSuspensions = async (c: Context, userId: number, now: Date) => {
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
  const sanctions = await c
    .get("cache")
    .entry(suspensionsCache, userId)
    .remember(async () => await loadSuspensions(c, userId, now));

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
  await c.get("cache").entry(suspensionsCache, userId).delete();
  if (disconnect) c.get("realtime").closeUserConnections(userId);
};
