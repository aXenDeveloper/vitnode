import type { ContentRevisionMeta } from "@/content/revisions";

import {
  contentDeliveryQueryKey,
  contentHistoryQueryKey,
  contentSchedulesQueryKey,
} from "../content-query";

/**
 * Where each editorial panel's answer is cached.
 *
 * Every key below is a literal extension of {@link contentItemQueryRoot}'s
 * children in `../content-query.ts`, which is what makes the whole family
 * disappear when a record is deleted: `removeContentItem` drops that prefix, and
 * a history dialog reopened afterwards has nothing to draw.
 *
 *     […item, "history",   { kind: "list" }]        every page of the timeline
 *     […item, "history",   { revision: 42 }]        one revision's snapshot
 *     […item, "schedules"]                          the pending and the done
 *     […item, "delivery",  locale]                  one language's addresses
 *
 * ## None of these is warmed by a loader, and that is the point
 *
 * A content list is 25 rows and each row can open four panels. Preloading any of
 * this would be a hundred requests to render a table, for data almost nobody
 * opens - so every one of these entries is filled by the panel that reads it,
 * when somebody opens it. The list's own query is the only thing a route warms.
 */

/** The one entry the whole revision timeline pages into. */
export const contentHistoryListQueryKey = (
  contentTypeId: string,
  itemId: number,
) => contentHistoryQueryKey(contentTypeId, itemId, { kind: "list" });

/**
 * One revision's snapshot.
 *
 * Its own entry rather than a field on the list's, because it is read on a
 * different event: the timeline arrives when the dialog opens, a snapshot only
 * when somebody expands that row. Under the same `history` root, so a restore
 * expires the timeline and every snapshot together - a restore rewrites what
 * "previous" means for the row above it.
 */
export const contentRevisionQueryKey = (
  contentTypeId: string,
  itemId: number,
  revisionId: number,
) => contentHistoryQueryKey(contentTypeId, itemId, { revision: revisionId });

/**
 * One record's delivery state, in one language.
 *
 * The locale is on the end because a localized content type has one canonical
 * path *per translation*: the same record answers to `/en/news/hello` and
 * `/pl/aktualnosci/czesc`, and an entry that did not name which was asked for
 * would serve one language's addresses under the other. `""` stands for a
 * content type with no translations, which has exactly one address and asks for
 * no locale at all.
 *
 * Still under `contentDeliveryQueryKey`, so `invalidateContentDelivery` expires
 * every language of one record with one call and a delete drops them all.
 */
export const contentDeliveryLocaleQueryKey = (
  contentTypeId: string,
  itemId: number,
  locale: string | undefined,
) => [...contentDeliveryQueryKey(contentTypeId, itemId), locale ?? ""] as const;

/** One record's schedules - re-exported so a panel has one import to reach for. */
export { contentSchedulesQueryKey };

/**
 * The timeline, flattened out of the pages the cursor walked.
 *
 * Deduplicated by revision id rather than trusted to be disjoint: the cursor is
 * exclusive, so pages *should* never overlap - but a restore landing between two
 * page requests shifts every row down by one, and a duplicated key is a React
 * warning and a row rendered twice. The first copy wins, which is the newer one.
 */
export const flattenContentRevisionPages = (
  pages: readonly { edges: ContentRevisionMeta[] }[],
): ContentRevisionMeta[] => {
  const seen = new Set<number>();

  return pages.flatMap(page =>
    page.edges.filter(edge => {
      if (seen.has(edge.id)) return false;
      seen.add(edge.id);

      return true;
    }),
  );
};

/**
 * The cursor the next page starts after, or `undefined` when there is none.
 *
 * `undefined` rather than `null` because that is what React Query reads as "no
 * more pages" - returning `null` would make it fetch one more time with a null
 * cursor, which the route answers by starting from the top again.
 */
export const nextContentRevisionCursor = (page: {
  pageInfo: { endCursor: null | number; hasNextPage: boolean };
}): number | undefined =>
  page.pageInfo.hasNextPage && page.pageInfo.endCursor !== null
    ? page.pageInfo.endCursor
    : undefined;
