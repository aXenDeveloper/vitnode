import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import {
  OPERATIONAL_STALE_TIME,
  RECORD_STALE_TIME,
} from "@vitnode/core/lib/query-freshness";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { CONFIG_PLUGIN } from "@/const";

import type { ForumSearch } from "./forum-links";

import { fetchForums, fetchForumStats } from "./forum-data";
import { fetchThreadPage } from "./thread-data";

/** {@link RECORD_STALE_TIME} - Administrators arrange forums rarely, and the forum pages' HTML is shared for a minute anyway. */
const FORUM_TREE_STALE_TIME = RECORD_STALE_TIME;

/** {@link RECORD_STALE_TIME} - A topic's own text changes only when its author edits it, and this tab's edits invalidate it. */
export const TOPIC_STALE_TIME = RECORD_STALE_TIME;

/** {@link OPERATIONAL_STALE_TIME} - Counts, topic lists and threads move with every post; this tab's own posts invalidate them at once. */
export const FORUM_ACTIVITY_STALE_TIME = OPERATIONAL_STALE_TIME;

/** {@link OPERATIONAL_STALE_TIME} - A moderator decides a submission somewhere else while its author waits to see the outcome. */
export const PENDING_STALE_TIME = OPERATIONAL_STALE_TIME;

const all = [CONFIG_PLUGIN.pluginId] as const;
const commentLinks = [...all, "comment-link"] as const;
const submissions = [...all, "pending"] as const;
const topicDetails = [...all, "topic"] as const;
const topicLists = [...all, "topic-list"] as const;

/** Every key starts with the plugin id, so a prefix never reaches another plugin's entries. */
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

/**
 * Whether every visitor is given this same answer. The Content Engine marks a
 * hidden record it shows to staff `private, no-store`; reusing that across a
 * sign-out would show it to whoever is in the tab next.
 */
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

/** One forum with its ancestors and children, by id or slug; `null` when there is none. */
export const forumQueryOptions = (idOrSlug: string) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => {
      const res = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
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
    // A miss is asked again: the forum may be created a moment later.
    staleTime: ({ state }) => (state.data ? FORUM_TREE_STALE_TIME : 0),
  });

/** The first page of a topic's thread - what the topic page renders on arrival. */
export const threadQueryOptions = (topicId: number) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => await fetchThreadPage({ topicId }),
    queryKey: forumQueryKeys.thread(topicId),
    staleTime: FORUM_ACTIVITY_STALE_TIME,
  });

/** After a comment is written: its thread, every count that includes it, and the author's submissions if it awaits approval. */
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

/** After a topic is created or edited: the topic under any slug, everything that shows its title or links to its slug, and the author's submissions. */
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
