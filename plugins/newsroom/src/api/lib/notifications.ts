import { buildContentNotifications } from "@vitnode/core/content/server";

import { articleContentType } from "@/content/article";
import { commentContentType } from "@/content/comment";

/**
 * Comment and reply notifications. Server-only: registered in
 * `config.api.ts`, never imported by a page.
 */
export const commentNotifications = buildContentNotifications({
  content: commentContentType,
  root: articleContentType,
  rules: {
    replies: {
      id: "newsroom.comment_reply",
      preset: "threadReply",
      recipients: { authorField: "author", rootAuthorField: "author" },
      messages: {
        label: "newsroom.notifications.comment_reply.label",
        description: "newsroom.notifications.comment_reply.description",
        comment: "newsroom.notifications.comment_reply.comment",
        reply: "newsroom.notifications.comment_reply.reply",
      },
      target: ({ root, content }) => `/news/${root.slug}#comment-${content.id}`,
      defaults: { inApp: true, email: "none" },
      email: true,
    },
  },
});
