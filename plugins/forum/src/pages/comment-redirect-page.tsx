import { redirect } from "@tanstack/react-router";
import { definePluginRoute } from "@vitnode/core/routing";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import { commentAnchorId, topicHref } from "./forum-links";
import { zodRelationId } from "./thread-data";

const zodCommentLink = z.object({ slug: z.string(), topic: zodRelationId });

/** A comment has no page of its own: its permalink is its place in the thread. */
const resolveComment = async (slug: string): Promise<never> => {
  const comment = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/comments",
    path: "/{slug}",
    args: { params: { slug: encodeURIComponent(slug) } },
  });

  if (comment.status !== 200 && comment.status !== 404) {
    throw new Error(`Resolving the comment "${slug}" failed.`);
  }

  const record = contentPageItem(
    comment.status === 200 ? zodCommentLink.parse(await comment.json()) : null,
  );

  const topic = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "forum",
    path: "/topics/{id}/slug",
    args: { params: { id: record.topic } },
  });

  const target = contentPageItem(
    topic.status === 200 ? await topic.json() : null,
  );

  // oxlint-disable-next-line typescript/only-throw-error
  throw redirect({
    href: `${topicHref(target.slug)}#${commentAnchorId(record.slug)}`,
    statusCode: 302,
  });
};

export const route = definePluginRoute({
  load: async ({ params }) => await resolveComment(params.slug),

  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("@vitnode/forum.comments.permalink"),
  }),
});

const CommentRedirectPage = () => null;

export default CommentRedirectPage;
