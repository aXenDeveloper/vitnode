import { queryOptions } from "@tanstack/react-query";
import {
  zodContentFileDescriptor,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { RECORD_STALE_TIME } from "@vitnode/core/lib/query-freshness";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

const POST_STALE_TIME = RECORD_STALE_TIME;

const zodBlogPost = z.object({
  content: zodRichTextDocument,
  coverImage: zodContentFileDescriptor.nullable(),
  coverImageAlt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const all = [manifest.id] as const;

export const blogQueryKeys = {
  all,
  post: (request: { locale: string; slug: string }) =>
    [...all, "post", request] as const,
};

const fetchBlogPost = async ({
  locale,
  slug,
}: {
  locale: string;
  slug: string;
}) => {
  const [resolution, detail] = await Promise.all([
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/blog",
      path: "/delivery/resolve/{slug}",
      args: {
        params: { slug: encodeURIComponent(slug) },
        query: { locale },
      },
    }),
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/blog",
      path: "/{slug}",
      args: {
        params: { slug: encodeURIComponent(slug) },
        query: { locale },
      },
    }),
  ]);

  if (resolution.status !== 200) {
    throw new Error(
      `Resolving the blog article "${slug}" answered ${resolution.status}.`,
    );
  }

  return {
    item: detail.status === 200 ? zodBlogPost.parse(await detail.json()) : null,
    resolution: await resolution.json(),
  };
};

export type BlogPostAnswer = Awaited<ReturnType<typeof fetchBlogPost>>;

const isSharedAnswer = ({ item, resolution }: BlogPostAnswer): boolean =>
  resolution.type === "redirect" ||
  (resolution.type === "content" && !resolution.hidden && item !== null);

export const blogPostQueryOptions = (request: {
  locale: string;
  slug: string;
}) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => await fetchBlogPost(request),
    queryKey: blogQueryKeys.post(request),
    staleTime: ({ state }) =>
      state.data && isSharedAnswer(state.data) ? POST_STALE_TIME : 0,
  });
