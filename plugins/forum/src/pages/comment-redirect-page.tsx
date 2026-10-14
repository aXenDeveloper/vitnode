import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import { commentAnchorId, topicHref } from "./forum-links";
import {
  forumQueryKeys,
  isSharedResponse,
  TOPIC_STALE_TIME,
} from "./forum-queries";
import { zodRelationId } from "./thread-data";

const zodCommentLink = z.object({ slug: z.string(), topic: zodRelationId });

/** Where a comment lives: its topic's slug and its own, `null` when there is none for this visitor. */
const commentLinkQueryOptions = (slug: string) =>
  queryOptions({
    queryFn: async () => {
      const comment = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "get",
        module: "content/comments",
        path: "/{slug}",
        args: { params: { slug: encodeURIComponent(slug) } },
      });

      if (comment.status === 404) return { link: null, shared: false };
      if (comment.status !== 200) {
        throw new Error(`Resolving the comment "${slug}" failed.`);
      }

      const record = zodCommentLink.parse(await comment.json());

      const topic = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "get",
        module: "forum",
        path: "/topics/{id}/slug",
        args: { params: { id: record.topic } },
      });

      return {
        link:
          topic.status === 200
            ? { comment: record.slug, topic: (await topic.json()).slug }
            : null,
        shared: isSharedResponse(comment) && topic.status === 200,
      };
    },
    queryKey: forumQueryKeys.commentLink(slug),
    // The same rule as a topic's: a miss or a hidden comment is asked again.
    staleTime: ({ state }) => (state.data?.shared ? TOPIC_STALE_TIME : 0),
  });

/** A comment has no page of its own: its permalink is its place in the thread. */
const resolveComment = async (
  queryClient: QueryClient,
  slug: string,
): Promise<never> => {
  const { comment, topic } = contentPageItem(
    (await queryClient.query(commentLinkQueryOptions(slug))).link,
  );

  // oxlint-disable-next-line typescript/only-throw-error
  throw redirect({
    href: `${topicHref(topic)}#${commentAnchorId(comment)}`,
    statusCode: 302,
  });
};

export const route = defineRoute({
  load: async ({ context, params }) =>
    await resolveComment(context.queryClient, params.slug),

  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("@vitnode/forum.comments.permalink"),
  }),
});

const CommentRedirectPage = () => null;

export default CommentRedirectPage;
