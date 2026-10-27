import { createContentModel } from "@vitnode/core/content/server";

import { blogCommentContentType } from "@/content/comment";

import { blog_posts } from "./posts";

/**
 * The server-side model of {@link blogCommentContentType}. Server-only.
 *
 * `article` is bound to `blog_posts.id`; `parent` is a self-relation the
 * engine resolves from the table it builds.
 */
export const commentContent = createContentModel(blogCommentContentType, {
  references: { article: () => blog_posts.id },
});

export const blog_comments = commentContent.table;
