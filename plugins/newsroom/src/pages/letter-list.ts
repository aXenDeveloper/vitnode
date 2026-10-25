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

export const LETTERS_HREF = "/letters";

/** `/letters`: newest first, 10 a page, searchable and filterable by desk. */
export const letterList = defineContentList({
  defaultSort: "newest",
  filters: { desk: contentListIdFilter },
  pageSize: 10,
  sorts: {
    newest: { order: "desc", orderBy: "publishedAt" },
    oldest: { order: "asc", orderBy: "publishedAt" },
    title: { order: "asc", orderBy: "title" },
  },
});

export type LetterListSort = (typeof letterList.sorts)[number];

export type LetterListSearch = ContentListSearch<
  LetterListSort,
  { desk: typeof contentListIdFilter }
>;

export const letterListSearch = (
  input: Record<string, unknown>,
): LetterListSearch => letterList.parseSearch(input);

const letterQueryKeys = {
  all: [manifest.id, "letters"] as const,
};

export const lettersQueryOptions = (request: {
  locale: string;
  search: LetterListSearch;
}) =>
  contentListQueryOptions({
    ...request,
    queryKey: letterQueryKeys.all,
    fetch: async ({ search }) => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/letters",
        path: "/",
        args: {
          query: {
            ...letterList.apiQuery(search),
            ...(search.desk === undefined
              ? {}
              : { desk: String(search.desk), includeDescendants: "true" }),
          },
        },
      });
      if (res.status !== 200) {
        throw new Error(`Loading letters answered ${res.status}.`);
      }

      return await res.json();
    },
  });

/** Expires every cached letter list, after a member posts or edits one. */
export const invalidateLetterLists = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: letterQueryKeys.all });
};

/** What the visitor may do with each letter on screen: `canEdit`, `canReport`. */
export const useLetterPermissions = (ids: readonly number[]) =>
  useContentPermissions({
    ids,
    queryKey: letterQueryKeys.all,
    fetch: async request => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/letters",
        path: "/permissions",
        args: { query: { ids: request.join(",") } },
      });
      if (res.status !== 200) throw new Error("Loading permissions failed.");

      return await res.json();
    },
  });
