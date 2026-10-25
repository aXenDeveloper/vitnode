import type { ContentListSearch } from "@vitnode/core/tanstack/content";

import {
  contentListQueryOptions,
  defineContentList,
} from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

/** `/news`: published articles, newest first, 10 a page. */
export const articleList = defineContentList({
  defaultSort: "newest",
  pageSize: 10,
  sorts: {
    newest: { order: "desc", orderBy: "publishedAt" },
    oldest: { order: "asc", orderBy: "publishedAt" },
    title: { order: "asc", orderBy: "title" },
  },
});

export type ArticleListSearch = ContentListSearch<
  (typeof articleList.sorts)[number]
>;

export const articlesQueryOptions = (request: {
  locale: string;
  search: ArticleListSearch;
}) =>
  contentListQueryOptions({
    ...request,
    queryKey: [manifest.id, "articles"],
    fetch: async ({ search }) => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/news",
        path: "/",
        args: { query: articleList.apiQuery(search) },
      });
      if (res.status !== 200) {
        throw new Error(`Loading articles answered ${res.status}.`);
      }

      return await res.json();
    },
  });
