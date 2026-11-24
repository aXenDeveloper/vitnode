import { zodContentPublicPerson } from "@vitnode/core/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

export const fetchForums = async (locale: string) => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/forums",
    path: "/",
    args: { query: { locale } },
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

export const zodFeedTopic = z.object({
  author: zodPerson,
  commentCount: z.number(),
  excerpt: z.string(),
  forum: z.number(),
  id: z.number(),
  lastActivityAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  score: z.number(),
  slug: z.string(),
  title: z.string(),
});

export type FeedTopic = z.infer<typeof zodFeedTopic>;

export const indexBy = <TItem, TKey>(
  items: readonly TItem[],
  key: (item: TItem) => TKey,
): Map<TKey, TItem> => new Map(items.map(item => [key(item), item]));
