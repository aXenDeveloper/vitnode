import type { Context } from "hono";

import { and, eq, sql } from "drizzle-orm";

import { core_search_popularity } from "@/database/search";

const SEARCH_POPULARITY_WEIGHTS = {
  click: 3,
  comment: 5,
  view: 1,
} as const;

export type SearchPopularitySignal = keyof typeof SEARCH_POPULARITY_WEIGHTS;

const SEARCH_POPULARITY_HALF_LIFE_DAYS = 7;

const HALF_LIFE_MS = SEARCH_POPULARITY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;

const NEGLIGIBLE_EXPONENT = -50;

const searchPopularityLogScore = (
  signal: SearchPopularitySignal,
  at: Date,
): number =>
  Math.log(SEARCH_POPULARITY_WEIGHTS[signal]) +
  (at.getTime() / HALF_LIFE_MS) * Math.LN2;

export const recordSearchPopularity = async (
  c: Context,
  {
    at = new Date(),
    itemId,
    itemType,
    signal,
  }: {
    at?: Date;
    itemId: string;
    itemType: string;
    signal: SearchPopularitySignal;
  },
): Promise<void> => {
  const incoming = searchPopularityLogScore(signal, at);
  const added = {
    clicks: signal === "click" ? 1 : 0,
    comments: signal === "comment" ? 1 : 0,
    views: signal === "view" ? 1 : 0,
  };
  const current = core_search_popularity.logScore;

  await c
    .get("db")
    .insert(core_search_popularity)
    .values({ itemType, itemId, logScore: incoming, ...added, updatedAt: at })
    .onConflictDoUpdate({
      target: [core_search_popularity.itemType, core_search_popularity.itemId],
      set: {
        logScore: sql`greatest(${current}, ${incoming}::double precision) + ln(1 + exp(greatest(${NEGLIGIBLE_EXPONENT}::double precision, -abs(${current} - ${incoming}::double precision))))`,
        clicks: sql`${core_search_popularity.clicks} + ${added.clicks}`,
        comments: sql`${core_search_popularity.comments} + ${added.comments}`,
        views: sql`${core_search_popularity.views} + ${added.views}`,
        updatedAt: at,
      },
    });
};

export const deleteSearchPopularity = async (
  c: Context,
  { itemId, itemType }: { itemId: string; itemType: string },
): Promise<void> => {
  await c
    .get("db")
    .delete(core_search_popularity)
    .where(
      and(
        eq(core_search_popularity.itemType, itemType),
        eq(core_search_popularity.itemId, itemId),
      ),
    );
};
