import { defineContentType, field } from "@vitnode/core/content";

import { blogPostContentType } from "./post";

export const BLOG_COMMENT_MAX_DEPTH = 6;

/**
 * A reader's comment on a blog article (`blog.comment`, table
 * `blog_comments`), threaded under the article up to
 * {@link BLOG_COMMENT_MAX_DEPTH} levels deep.
 *
 * - Signed-in members write and edit their own comments through the public
 *   API at `content/comments`; the thread route reads them as a tree.
 * - Shared across languages: a comment is written in one language and shows
 *   under every translation of its article.
 * - Hiding, reports and revisions for moderation. Comments of an unpublished
 *   article are not served; under a hidden article only readers who may see
 *   it (its authors, editors and moderators) read and write them. Deleting
 *   the article deletes them.
 * - Indexed for search, Discover and profile timelines as "commented on
 *   <article>" - the default every threaded content type gets.
 * - A permalink at `/blog/comments/:slug` that redirects to the comment's
 *   place under its article; ModCP links reported comments there.
 *
 * Browser-safe: the server model is `commentContent` in
 * `@vitnode/blog/database/comments`.
 */
export const blogCommentContentType = defineContentType({
  id: "blog.comment",
  tableName: "blog_comments",

  fields: {
    slug: field.slug({ generated: true }),
    body: field.richText({ required: true }),
    author: field.user(),
    article: field.relation({
      target: () => blogPostContentType,
      required: true,
      onDelete: "cascade",
    }),
    parent: field.relation({
      self: true,
      nullable: true,
      onDelete: "set null",
    }),
  },

  publication: true,
  visibility: true,
  reports: { titleField: "body", snapshotFields: ["body"], selfReport: true },
  editorial: { revisions: { retention: 20 } },

  indexes: [{ on: ["article", "parent", "createdAt"] }],

  publicApi: {
    path: "comments",
    fields: [
      "id",
      "slug",
      "body",
      "article",
      "parent",
      "publishedAt",
      "createdAt",
      "updatedAt",
    ],
    filterableFields: ["article"],
    people: ["author"],
  },

  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["body", "article", "parent"], status: "published" },
    update: { fields: ["body"] },
  },

  delivery: {
    path: "/blog/comments/:slug",
  },

  thread: {
    parent: "parent",
    root: "article",
    maxDepth: BLOG_COMMENT_MAX_DEPTH,
  },

  admin: { titleField: "slug" },
});
