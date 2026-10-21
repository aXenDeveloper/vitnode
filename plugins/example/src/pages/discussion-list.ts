import type { QueryClient } from "@tanstack/react-query";
import type { ContentListSearch } from "@vitnode/core/tanstack/content";

import {
  contentListIdFilter,
  contentListQueryOptions,
  defineContentList,
  useContentPermissions,
} from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

export const DISCUSSIONS_HREF = "/discussions";

/** `/discussions`: newest first, 10 a page, searchable and filterable by board. */
export const discussionList = defineContentList({
  defaultSort: "newest",
  filters: { board: contentListIdFilter },
  pageSize: 10,
  sorts: {
    newest: { order: "desc", orderBy: "publishedAt" },
    oldest: { order: "asc", orderBy: "publishedAt" },
    title: { order: "asc", orderBy: "title" },
  },
});

export type DiscussionListSort = (typeof discussionList.sorts)[number];

export type DiscussionListSearch = ContentListSearch<
  DiscussionListSort,
  { board: typeof contentListIdFilter }
>;

export const discussionListSearch = (
  input: Record<string, unknown>,
): DiscussionListSearch => discussionList.parseSearch(input);

const discussionQueryKeys = {
  all: [manifest.id, "discussions"] as const,
};

export const discussionsQueryOptions = (request: {
  locale: string;
  search: DiscussionListSearch;
}) =>
  contentListQueryOptions({
    ...request,
    queryKey: discussionQueryKeys.all,
    fetch: async ({ search }) => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/discussions",
        path: "/",
        args: {
          query: {
            ...discussionList.apiQuery(search),
            ...(search.board === undefined
              ? {}
              : { board: String(search.board), includeDescendants: "true" }),
          },
        },
      });
      if (res.status !== 200) {
        throw new Error(`Loading discussions answered ${res.status}.`);
      }

      return await res.json();
    },
  });

/** Expires every cached discussion list, after a member posts or edits one. */
export const invalidateDiscussionLists = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: discussionQueryKeys.all });
};

/** What the visitor may do with each discussion on screen: `canEdit`, `canReport`. */
export const useDiscussionPermissions = (ids: readonly number[]) =>
  useContentPermissions({
    ids,
    queryKey: discussionQueryKeys.all,
    fetch: async request => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/discussions",
        path: "/permissions",
        args: { query: { ids: request.join(",") } },
      });
      if (res.status !== 200) throw new Error("Loading permissions failed.");

      return await res.json();
    },
  });
