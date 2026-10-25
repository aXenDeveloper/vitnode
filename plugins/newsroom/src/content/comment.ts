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

  publicApi: {
    path: "comments",
    fields: ["id", "slug", "body", "article", "parent", "publishedAt"],
    people: ["author"],
  },

  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["body", "article", "parent"], status: "published" },
    update: { fields: ["body"] },
  },

  thread: { parent: "parent", root: "article", maxDepth: COMMENT_MAX_DEPTH },

  admin: { path: "newsroom/comments", titleField: "slug" },
});
