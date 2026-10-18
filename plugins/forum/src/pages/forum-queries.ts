import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import {
  OPERATIONAL_STALE_TIME,
  RECORD_STALE_TIME,
} from "@vitnode/core/lib/query-freshness";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

import type { ForumSearch } from "./forum-links";

import { fetchForums, fetchForumStats } from "./forum-data";
import { fetchThreadPage } from "./thread-data";

const FORUM_TREE_STALE_TIME = RECORD_STALE_TIME;

export const TOPIC_STALE_TIME = RECORD_STALE_TIME;

export const FORUM_ACTIVITY_STALE_TIME = OPERATIONAL_STALE_TIME;

export const PENDING_STALE_TIME = OPERATIONAL_STALE_TIME;

const all = [manifest.id] as const;
const commentLinks = [...all, "comment-link"] as const;
const submissions = [...all, "pending"] as const;
const topicDetails = [...all, "topic"] as const;
const topicLists = [...all, "topic-list"] as const;

export const forumQueryKeys = {
  all,
  commentLink: (slug: string) => [...commentLinks, slug] as const,
  commentLinks: () => commentLinks,
  forum: (idOrSlug: string) => [...all, "forum", idOrSlug] as const,
  forums: () => [...all, "forums"] as const,
  forumStats: () => [...all, "forum-stats"] as const,
  pending: (userId: number, page: number) =>
    [...submissions, userId, { page }] as const,
  submissions: () => submissions,
  thread: (topicId: number) => [...all, "thread", topicId] as const,
  topic: (slug: string) => [...topicDetails, slug] as const,
  topicDetails: () => topicDetails,
  topicList: (request: ForumSearch & { forumId: number }) =>
    [...topicLists, request] as const,
  topicLists: () => topicLists,
};

export const isSharedResponse = (res: Response): boolean =>
  !/\b(?:no-store|private)\b/i.test(res.headers.get("cache-control") ?? "");

export const forumsQueryOptions = () =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: fetchForums,
    queryKey: forumQueryKeys.forums(),
    staleTime: FORUM_TREE_STALE_TIME,
  });

export const forumStatsQueryOptions = () =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: fetchForumStats,
    queryKey: forumQueryKeys.forumStats(),
    staleTime: FORUM_ACTIVITY_STALE_TIME,
  });

export const forumQueryOptions = (idOrSlug: string) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/forums",
        path: "/{idOrSlug}",
        args: { params: { idOrSlug: encodeURIComponent(idOrSlug) } },
      });

      if (res.status === 404) return null;
      if (res.status !== 200) throw new Error("Loading the forum failed.");

      return await res.json();
    },
    queryKey: forumQueryKeys.forum(idOrSlug),
    staleTime: ({ state }) => (state.data ? FORUM_TREE_STALE_TIME : 0),
  });

/**
 * The forum by id or slug, seeded under its other key as well.
 *
 * The forum page asks by slug and the topic page by id, so without this the
 * same response is fetched twice when a reader moves between them. A slug made
 * only of digits is left alone: the route reads it as an id, so caching the
 * forum under it would answer for a different forum.
 */
export const queryForum = async (
  queryClient: QueryClient,
  idOrSlug: string,
) => {
  const data = await queryClient.query(forumQueryOptions(idOrSlug));
  if (!data) return data;

  const { id, slug } = data.container;
  // Through `query` with the data already in hand, so the copy is built from
  // the same options - `meta` included, which keeps it out of the SSR payload.
  // A fresh entry is left as it is; a stale one takes this newer copy.
  await Promise.all(
    [String(id), slug]
      .filter(key => key !== idOrSlug && !(key === slug && /^\d+$/.test(slug)))
      .map(
        async key =>
          await queryClient.query({
            ...forumQueryOptions(key),
            queryFn: () => data,
          }),
      ),
  );

  return data;
};

export const threadQueryOptions = (topicId: number) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => await fetchThreadPage({ topicId }),
    queryKey: forumQueryKeys.thread(topicId),
    staleTime: FORUM_ACTIVITY_STALE_TIME,
  });

export const invalidateForumComments = async (
  queryClient: QueryClient,
  topicId: number,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: forumQueryKeys.submissions() }),
    queryClient.invalidateQueries({ queryKey: forumQueryKeys.thread(topicId) }),
    queryClient.invalidateQueries({ queryKey: forumQueryKeys.topicLists() }),
    queryClient.invalidateQueries({ queryKey: forumQueryKeys.forumStats() }),
  ]);
};

export const invalidateForumTopics = async (
  queryClient: QueryClient,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: forumQueryKeys.commentLinks() }),
    queryClient.invalidateQueries({ queryKey: forumQueryKeys.submissions() }),
    queryClient.invalidateQueries({
      queryKey: forumQueryKeys.topicDetails(),
    }),
    queryClient.invalidateQueries({ queryKey: forumQueryKeys.topicLists() }),
    queryClient.invalidateQueries({ queryKey: forumQueryKeys.forumStats() }),
  ]);
};
