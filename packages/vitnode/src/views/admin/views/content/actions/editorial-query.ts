import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import type {
  ContentRevisionDetail,
  ContentRevisionMeta,
} from "@/content/revisions";

import type {
  ContentDeliveryPanelResult,
  ContentRevisionPageResult,
  ContentScheduleListResult,
} from "./editorial-api";
import type { ContentEditorialTransport } from "./editorial-transport";

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
 * The four panels' query definitions, next to the keys they cache under.
 *
 * Declared here rather than inline in each panel for one reason that is worth
 * more than the tidiness: it makes the retry policy a **property of the family**
 * rather than four literals in four components. The Content Engine was the only
 * AdminCP screen group that inherited Query's default of three attempts with
 * exponential backoff, so a `403` on a history dialog was three requests and a
 * `429` was three more - and `editorial-query.test.ts` now asserts across these
 * factories, so a fifth panel cannot be added without the rule.
 *
 * `retry: false` for the same reason it is spelled in `cron-query.ts`,
 * `files-query.ts`, `users-query.ts` and the rest: none of the answers these
 * reads get back are made better by asking again. A `403` is an authorization
 * answer, a `404` is a record somebody deleted, and a `429` is the limiter
 * asking for *fewer* requests.
 *
 * Each takes the transport method it calls rather than the whole transport, so
 * the module stays a pure function of a fetcher - no React, no context, nothing
 * a test has to render. The panels pass `transport.listSchedules` and friends.
 *
 * What is deliberately **not** here is `enabled`: whether a revision row has
 * been expanded is the row's own state, so it stays at the call site with the
 * rest of the UI's business.
 */

/** Every schedule on one record, and whether anything will run them. */
export const contentSchedulesQueryOptions = ({
  contentTypeId,
  itemId,
  listSchedules,
}: {
  contentTypeId: string;
  itemId: number;
  listSchedules: ContentEditorialTransport["listSchedules"];
}) =>
  queryOptions<ContentScheduleListResult>({
    queryFn: async () => await listSchedules(contentTypeId, itemId),
    queryKey: contentSchedulesQueryKey(contentTypeId, itemId),
    retry: false,
  });

/**
 * The revision timeline, newest first, paged by the cursor rule below.
 *
 * `initialPageParam` is `undefined` - the first page asks for no cursor at all -
 * and {@link nextContentRevisionCursor} decides whether there is another.
 */
export const contentRevisionHistoryQueryOptions = ({
  contentTypeId,
  itemId,
  listRevisions,
}: {
  contentTypeId: string;
  itemId: number;
  listRevisions: ContentEditorialTransport["listRevisions"];
}) =>
  infiniteQueryOptions<
    ContentRevisionPageResult,
    Error,
    { pageParams: (number | undefined)[]; pages: ContentRevisionPageResult[] },
    readonly unknown[],
    number | undefined
  >({
    getNextPageParam: nextContentRevisionCursor,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) =>
      await listRevisions(contentTypeId, itemId, pageParam),
    queryKey: contentHistoryListQueryKey(contentTypeId, itemId),
    retry: false,
  });

/**
 * One revision's snapshot.
 *
 * `revisionId` is the row's, and a row with none has nothing to read - the panel
 * gates that with `enabled`, which stays at the call site.
 */
export const contentRevisionQueryOptions = ({
  contentTypeId,
  getRevision,
  itemId,
  revisionId,
}: {
  contentTypeId: string;
  getRevision: ContentEditorialTransport["getRevision"];
  itemId: number;
  revisionId: number;
}) =>
  queryOptions<{ error?: string; revision?: ContentRevisionDetail }>({
    queryFn: async () => await getRevision(contentTypeId, itemId, revisionId),
    queryKey: contentRevisionQueryKey(contentTypeId, itemId, revisionId),
    retry: false,
  });

/** One record's delivery state, in one language. */
export const contentDeliveryQueryOptions = ({
  contentTypeId,
  itemId,
  locale,
  readDelivery,
}: {
  contentTypeId: string;
  itemId: number;
  locale?: string;
  readDelivery: ContentEditorialTransport["readDelivery"];
}) =>
  queryOptions<ContentDeliveryPanelResult>({
    queryFn: async () => await readDelivery(contentTypeId, itemId, locale),
    queryKey: contentDeliveryLocaleQueryKey(contentTypeId, itemId, locale),
    retry: false,
  });

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
