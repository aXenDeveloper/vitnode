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

/** The one entry the whole revision timeline pages into. */
export const contentHistoryListQueryKey = (
  contentTypeId: string,
  itemId: number,
) => contentHistoryQueryKey(contentTypeId, itemId, { kind: "list" });

export const contentRevisionQueryKey = (
  contentTypeId: string,
  itemId: number,
  revisionId: number,
) => contentHistoryQueryKey(contentTypeId, itemId, { revision: revisionId });

export const contentDeliveryLocaleQueryKey = (
  contentTypeId: string,
  itemId: number,
  locale: string | undefined,
) => [...contentDeliveryQueryKey(contentTypeId, itemId), locale ?? ""] as const;

/** One record's schedules - re-exported so a panel has one import to reach for. */
export { contentSchedulesQueryKey };

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

export const nextContentRevisionCursor = (page: {
  pageInfo: { endCursor: null | number; hasNextPage: boolean };
}): number | undefined =>
  page.pageInfo.hasNextPage && page.pageInfo.endCursor !== null
    ? page.pageInfo.endCursor
    : undefined;
