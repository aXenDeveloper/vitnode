import { buildContentNotifications } from "@vitnode/core/content/server";

import { commentContentType } from "@/content/comment";
import { topicContentType } from "@/content/topic";
import {
  commentPermalink,
  FORUM_PENDING_HREF,
  topicHref,
} from "@/pages/forum-links";

/** Comments, replies and moderation decisions on comments. Server-only. */
export const commentNotifications = buildContentNotifications({
  content: commentContentType,
  root: topicContentType,
  rules: {
    replies: {
      id: "forum.comment_reply",
      preset: "threadReply",
      recipients: { authorField: "author", rootAuthorField: "author" },
      messages: {
        label: "@vitnode/forum.notifications.comment_reply.label",
        description: "@vitnode/forum.notifications.comment_reply.description",
        comment: "@vitnode/forum.notifications.comment_reply.comment",
        reply: "@vitnode/forum.notifications.comment_reply.reply",
      },
      target: ({ content }) => commentPermalink(content.slug),
    },
    decisions: {
      id: "forum.comment_decision",
      preset: "moderationDecision",
      messages: {
        label: "@vitnode/forum.notifications.comment_decision.label",
        description:
          "@vitnode/forum.notifications.comment_decision.description",
        approved: "@vitnode/forum.notifications.comment_decision.approved",
        rejected: "@vitnode/forum.notifications.comment_decision.rejected",
      },
      // A rejected comment is not on the topic page, but it is on the
      // author's own pending list.
      target: ({ content, decision }) =>
        decision.status === "approved"
          ? commentPermalink(content.slug)
          : FORUM_PENDING_HREF,
    },
  },
});

/** Moderation decisions on topics. Server-only. */
export const topicNotifications = buildContentNotifications({
  content: topicContentType,
  rules: {
    decisions: {
      id: "forum.topic_decision",
      preset: "moderationDecision",
      messages: {
        label: "@vitnode/forum.notifications.topic_decision.label",
        description: "@vitnode/forum.notifications.topic_decision.description",
        approved: "@vitnode/forum.notifications.topic_decision.approved",
        rejected: "@vitnode/forum.notifications.topic_decision.rejected",
      },
      target: ({ content, decision }) =>
        decision.status === "approved"
          ? topicHref(content.slug)
          : FORUM_PENDING_HREF,
    },
  },
});
