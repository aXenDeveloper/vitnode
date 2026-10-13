import { defineContentType, field } from "@vitnode/core/content";

import { topicContentType } from "@/content/topic";

export const FORUM_REPLY_MAX_DEPTH = 6;

export const replyContentType = defineContentType({
  id: "forum.reply",
  tableName: "forum_replies",

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
  editorial: { revisions: { retention: 20 } },

  indexes: [{ on: ["topic", "parent", "createdAt"] }],

  publicApi: {
    path: "replies",
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

  thread: {
    parent: "parent",
    root: "topic",
    maxDepth: FORUM_REPLY_MAX_DEPTH,
  },

  admin: {
    path: "forum/replies",
    titleField: "slug",
    list: {
      columns: [
        "status",
        "slug",
        "topic",
        "author",
        "publishedAt",
        "updatedAt",
      ],
      orderableFields: ["slug"],
      defaultOrderBy: "updatedAt",
      defaultOrder: "desc",
    },
  },
});
