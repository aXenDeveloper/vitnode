import { zodContentPublicPerson } from "@vitnode/core/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

export const fetchForums = async () => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/forums",
    path: "/",
    args: { query: {} },
  });

  if (res.status !== 200) throw new Error("Loading the forums failed.");

  const { items } = await res.json();

  return items;
};

export type Forum = Awaited<ReturnType<typeof fetchForums>>[number];

export const fetchForumStats = async (): Promise<ForumStats[]> => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "forum",
    path: "/stats/forums",
  });

  if (res.status !== 200) return [];

  const { items } = await res.json();

  return items;
};

export interface ForumStats {
  commentCount: number;
  forumId: number;
  latestTopic: null | {
    id: number;
    publishedAt: null | string;
    slug: string;
    title: string;
  };
  topicCount: number;
}

export const zodPerson = zodContentPublicPerson.nullable().catch(null);

export type ForumPerson = z.infer<typeof zodPerson>;

export const zodTopicListRow = z.object({
  author: zodPerson,
  commentCount: z.number(),
  id: z.number(),
  lastCommentAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  slug: z.string(),
  title: z.string(),
});

export type TopicListRowData = z.infer<typeof zodTopicListRow>;

export const indexBy = <TItem, TKey>(
  items: readonly TItem[],
  key: (item: TItem) => TKey,
): Map<TKey, TItem> => new Map(items.map(item => [key(item), item]));
