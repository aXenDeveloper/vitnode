import { redirect } from "@tanstack/react-router";
import { definePluginRoute } from "@vitnode/core/routing";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import { replyAnchorId, topicHref } from "./forum-links";
import { zodRelationId } from "./thread-data";

const zodReplyLink = z.object({ slug: z.string(), topic: zodRelationId });

/** A reply has no page of its own: its permalink is its place in the thread. */
const resolveReply = async (slug: string): Promise<never> => {
  const reply = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/replies",
    path: "/{slug}",
    args: { params: { slug: encodeURIComponent(slug) } },
  });

  if (reply.status !== 200 && reply.status !== 404) {
    throw new Error(`Resolving the reply "${slug}" failed.`);
  }

  const record = contentPageItem(
    reply.status === 200 ? zodReplyLink.parse(await reply.json()) : null,
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
    href: `${topicHref(target.slug)}#${replyAnchorId(record.slug)}`,
    statusCode: 302,
  });
};

export const route = definePluginRoute({
  load: async ({ params }) => await resolveReply(params.slug),

  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("@vitnode/forum.replies.permalink"),
  }),
});

const ReplyRedirectPage = () => null;

export default ReplyRedirectPage;
