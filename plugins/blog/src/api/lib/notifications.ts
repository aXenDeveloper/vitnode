import { buildContentNotifications } from "@vitnode/core/content/server";

import { blogCommentContentType } from "@/content/comment";
import { blogPostContentType } from "@/content/post";

/**
 * Tells a comment's author when someone replies to it. Server-only: registered
 * in `config.api.ts`, never imported by a page.
 *
 * Replies only: an article's `authorId` lists several people, and the
 * `threadReply` preset notifies one author per record, so a new top-level
 * comment notifies nobody. The texts leave out `{title}`: the article's title
 * is localized, so the preset has no single title to pass. The link is the
 * comment's `/blog/comments/:slug` permalink, which redirects to its anchor
 * under the article in the reader's language.
 */
export const commentNotifications = buildContentNotifications({
  content: blogCommentContentType,
  root: blogPostContentType,
  rules: {
    replies: {
      id: "blog.comment_reply",
      preset: "threadReply",
      recipients: { authorField: "author" },
      messages: {
        label: "@vitnode/blog.notifications.comment_reply.label",
        description: "@vitnode/blog.notifications.comment_reply.description",
        comment: "@vitnode/blog.notifications.comment_reply.comment",
        reply: "@vitnode/blog.notifications.comment_reply.reply",
      },
      target: ({ content }) =>
        `/blog/comments/${encodeURIComponent(content.slug)}`,
      defaults: { inApp: true, email: "none" },
      email: true,
    },
  },
});
