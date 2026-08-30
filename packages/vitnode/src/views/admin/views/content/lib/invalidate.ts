import type { QueryClient } from "@tanstack/react-query";

import {
  contentDeliveryQueryKey,
  contentHistoryQueryRoot,
  contentItemQueryRoot,
  contentListQueryRoot,
  contentOptionsQueryRoot,
  contentSchedulesQueryKey,
  contentTranslationsQueryKey,
} from "../content-query";

/**
 * What each Content Engine write owes the query cache, one prefix at a time.
 *
 * Narrow on purpose. `contentQueryRoot()` would expire every content type in the
 * installation and `["vitnode"]` would expire the sidebar, the session and the
 * search index with it - so nothing here reaches above the one content type that
 * was written to, and most of it reaches no further than the one record.
 *
 *     invalidateContentList        the rows changed
 *     invalidateContentItem        this record changed, and everything under it
 *     removeContentItem            this record is gone
 *     invalidateContentHistory     a revision was added or restored
 *     invalidateContentTranslations one language of it moved
 *     invalidateContentSchedules   a schedule was booked or cancelled
 *     invalidateContentDelivery    the canonical address moved
 *
 * Every key comes from `../content-query.ts` and none is spelled here, which is
 * the point: a mutation and the read it invalidates cannot disagree about what
 * they are naming, in either AdminCP.
 *
 * ## Invalidate versus remove
 *
 * Invalidating marks an entry stale and keeps showing it while the fresh answer
 * arrives, which is what a table under an open dialog needs. Removing drops it,
 * and is right in exactly two cases:
 *
 * - **A deleted record.** Its detail, its translations, its revisions, its
 *   schedules and its delivery state are facts about something that no longer
 *   exists. Left merely stale they stay renderable - a history dialog reopened
 *   from a stale row would draw a timeline for a deleted record.
 * - **A reference picker.** The AdminCP's query client is configured
 *   `refetchOnMount: false`, so a stale picker is still served from cache the
 *   next time a form opens - and a deleted category would stay on offer.
 *
 * ## These are host-neutral
 *
 * A `QueryClient` is the same object in both AdminCPs - `views/layouts/provider`
 * mounts one for Next.js, the router owns one under TanStack Start - so a shared
 * panel can invalidate its own reads without knowing which host it is in. What
 * the two hosts do *not* share is the work outside React Query: `revalidatePath`
 * and the public-cache tag arithmetic on one side, `router.invalidate()` on the
 * other. That stays behind each host's transport.
 */

/** Every page, sort, search and filter of one content type's list. */
export const invalidateContentList = async (
  queryClient: QueryClient,
  contentTypeId: string,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentListQueryRoot(contentTypeId),
  });
};

/**
 * One record and everything hanging off it - detail, translations, revisions,
 * schedules, delivery.
 *
 * By prefix rather than as a list of keys, so a child family added tomorrow is
 * collected without anybody remembering to add it here.
 */
export const invalidateContentItem = async (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentItemQueryRoot(contentTypeId, itemId),
  });
};

/**
 * Drops one record from the cache entirely, children included.
 *
 * Synchronous and deliberately not awaited-on-network: there is nothing to
 * refetch for a record that is gone. What matters is that nothing can render it
 * afterwards.
 */
export const removeContentItem = (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): void => {
  queryClient.removeQueries({
    queryKey: contentItemQueryRoot(contentTypeId, itemId),
  });
};

/**
 * One record's revision history - every page of it.
 *
 * A root rather than a key, because the history panel pages: a restore adds a
 * revision at the top, which shifts every page below it.
 */
export const invalidateContentHistory = async (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentHistoryQueryRoot(contentTypeId, itemId),
  });
};

/** Every language of one record, values included. */
export const invalidateContentTranslations = async (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentTranslationsQueryKey(contentTypeId, itemId),
  });
};

/** One record's pending and completed publication schedules. */
export const invalidateContentSchedules = async (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentSchedulesQueryKey(contentTypeId, itemId),
  });
};

/** One record's canonical path and the addresses it used to answer to. */
export const invalidateContentDelivery = async (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentDeliveryQueryKey(contentTypeId, itemId),
  });
};

/**
 * Every reference picker offering rows of one content type.
 *
 * Removed rather than invalidated, for the `refetchOnMount: false` reason above.
 * Keyed by what the picker *offers*, so a category write expires the article
 * form's category picker without either screen knowing the other exists.
 */
export const removeContentOptions = (
  queryClient: QueryClient,
  target: string,
): void => {
  queryClient.removeQueries({ queryKey: contentOptionsQueryRoot(target) });
};
