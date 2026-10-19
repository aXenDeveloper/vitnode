import { defineContentType, field } from "@vitnode/core/content";

import { topicContentType } from "@/content/topic";

export const FORUM_COMMENT_MAX_DEPTH = 6;

export const commentContentType = defineContentType({
  id: "forum.comment",
  tableName: "forum_comments",

  fields: {
    slug: field.slug({ generated: true }),
    body: field.richText({ required: true }),
    author: field.user(),
    topic: field.relation({
      target: () => topicContentType,
      required: true,
      container: true,
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
  // A comment has no title of its own, so moderators read its body.
  reports: { snapshotFields: ["body"] },
  editorial: { revisions: { retention: 20 } },

  indexes: [{ on: ["topic", "parent", "createdAt"] }],

  publicApi: {
    path: "comments",
    fields: [
      "id",
      "slug",
      "body",
      "topic",
      "parent",
      "publishedAt",
      "createdAt",
      "updatedAt",
    ],
    filterableFields: ["topic"],
    people: ["author"],
  },

  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["body", "topic", "parent"], status: "published" },
    update: { fields: ["body"] },
  },

  search: {
    titleField: "topic",
    contentFields: ["body"],
    authorField: "author",
    pathTemplate: "/forum/comments/{slug}",
  },

  thread: {
    parent: "parent",
    root: "topic",
    maxDepth: FORUM_COMMENT_MAX_DEPTH,
  },

  admin: { titleField: "slug" },
});
