import type { Context } from "hono";

import { setPageCacheTags } from "@vitnode/core/api/lib/page-cache";
import {
  contentAccessTag,
  contentContainerTag,
  contentPublicListTag,
} from "@vitnode/core/content";
import { createContentAccess } from "@vitnode/core/content/server";
import { and, count, eq, inArray, max } from "drizzle-orm";

import {
  readForumStatsGeneration,
  topicStatsCache,
} from "@/api/lib/stats-cache";
import { forumContainers } from "@/content/forums";
import { commentContent } from "@/database/comments";
import { topicContent } from "@/database/topics";

import { publicComment, publicTopic } from "./public-condition";

export const iso = (value: Date | null | string | undefined): null | string =>
  value === null || value === undefined ? null : new Date(value).toISOString();

const statsTags = (): string[] => [
  contentPublicListTag(topicContent.definition.id),
  contentPublicListTag(commentContent.definition.id),
  contentContainerTag(forumContainers.id),
  contentAccessTag(forumContainers.id),
];

/**
 * The headers of a stats response: shared (and page-cache tagged) only when
 * no access rule can change it, `private, no-store` otherwise.
 */
export const forumStatsHeaders = async (
  c: Context,
): Promise<Record<string, string>> => {
  if (!(await createContentAccess(c).isOpen(topicContent))) {
    return { "Cache-Control": "private, no-store" };
  }

  setPageCacheTags(c, statsTags());

  return {};
};

interface TopicStatsItem {
  commentCount: number;
  lastCommentAt: null | string;
  topicId: number;
}

/**
 * Public comment count and last public comment time for each of `ids` that has
 * any, cached per id set: a forum page asks for the same page of topics far
 * more often than any of them gains a comment.
 */
export const loadTopicStats = async (
  c: Context,
  ids: readonly number[],
): Promise<TopicStatsItem[]> => {
  const unique = [...new Set(ids)]
    .filter(id => Number.isSafeInteger(id))
    .toSorted((a, b) => a - b);
  if (unique.length === 0) return [];

  const comments = commentContent.table;
  const topics = topicContent.table;
  const generation = await readForumStatsGeneration(c);

  return await c
    .get("cache")
    .entry(topicStatsCache, generation, unique)
    .remember(async () => {
      const rows = await c
        .get("db")
        .select({
          lastCommentAt: max(comments.publishedAt),
          topicId: comments.topic,
          value: count(),
        })
        .from(comments)
        .innerJoin(topics, eq(comments.topic, topics.id))
        .where(
          and(inArray(comments.topic, unique), publicComment(), publicTopic()),
        )
        .groupBy(comments.topic);

      return rows.map(row => ({
        lastCommentAt: iso(row.lastCommentAt),
        commentCount: row.value,
        topicId: row.topicId,
      }));
    });
};
