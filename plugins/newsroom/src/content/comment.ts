import { defineContentType, field } from "@vitnode/core/content";

import { articleContentType } from "@/content/article";

/** How deep replies nest. The section hides **Reply** at this depth. */
export const COMMENT_MAX_DEPTH = 4;

export const commentContentType = defineContentType({
  id: "newsroom.comment",
  tableName: "newsroom_comments",

  fields: {
    slug: field.slug({ generated: true }),
    body: field.richText({ required: true }),
    author: field.user(),
    article: field.relation({
      target: () => articleContentType,
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
  reports: { titleField: "body", snapshotFields: ["body"] },

  publicApi: {
    path: "article-comments",
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
    people: ["author"],
  },

  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["body", "article", "parent"], status: "published" },
    update: { fields: ["body"] },
  },

  // The permalink reports link to; its page redirects to the comment under
  // its article. Delivery claims `publicApi.path` site-wide, which is why
  // these comments are `article-comments`: the blog already owns `comments`.
  delivery: { path: "/news/comments/:slug" },

  thread: { parent: "parent", root: "article", maxDepth: COMMENT_MAX_DEPTH },

  admin: { path: "newsroom/comments", titleField: "slug" },
});
