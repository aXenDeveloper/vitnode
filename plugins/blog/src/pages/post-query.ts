import { queryOptions } from "@tanstack/react-query";
import {
  zodContentFileDescriptor,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { RECORD_STALE_TIME } from "@vitnode/core/lib/query-freshness";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

/** {@link RECORD_STALE_TIME} - An article changes when an editor saves it, well inside the five minutes its HTML is cached for. */
const POST_STALE_TIME = RECORD_STALE_TIME;

const zodBlogPost = z.object({
  content: zodRichTextDocument,
  coverImage: zodContentFileDescriptor.nullable(),
  coverImageAlt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const all = [CONFIG_PLUGIN.pluginId] as const;

/** Every key starts with the plugin id, so a prefix never reaches another plugin's entries. */
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
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "content/blog",
      path: "/delivery/resolve/{slug}",
      args: {
        params: { slug: encodeURIComponent(slug) },
        query: { locale },
      },
    }),
    fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
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

/**
 * Whether every visitor gets this same answer. A hidden article is answered
 * only to staff, and a miss may be one they can see - reusing either across a
 * sign-in or sign-out would show the next visitor somebody else's page.
 */
const isSharedAnswer = ({ item, resolution }: BlogPostAnswer): boolean =>
  resolution.type === "redirect" ||
  (resolution.type === "content" && !resolution.hidden && item !== null);

export const blogPostQueryOptions = (request: {
  locale: string;
  slug: string;
}) =>
  queryOptions({
    queryFn: async () => await fetchBlogPost(request),
    queryKey: blogQueryKeys.post(request),
    staleTime: ({ state }) =>
      state.data && isSharedAnswer(state.data) ? POST_STALE_TIME : 0,
  });
