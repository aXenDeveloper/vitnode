import { defineContentType, field } from "@vitnode/core/content";

import { categoryContentType } from "@/content/category";

export const articleContentType = defineContentType({
  id: "newsroom.article",
  tableName: "newsroom_articles",

  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    body: field.richText({ required: true }),
    author: field.user(),
    category: field.relation({
      target: () => categoryContentType,
      nullable: true,
      onDelete: "set null",
    }),
  },

  publication: true,

  publicApi: {
    path: "news",
    fields: ["id", "title", "slug", "body", "category", "publishedAt"],
    listFields: ["id", "title", "slug", "publishedAt"],
    searchableFields: ["title"],
    orderableFields: ["title"],
  },

  delivery: true,

  editorial: true,

  reports: true,

  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["title", "body"], status: "published" },
    update: { fields: ["title", "body"] },
  },

  admin: {
    path: "newsroom/articles",
    titleField: "title",
    list: {
      columns: ["status", "title", "category", "updatedAt"],
      orderableFields: ["title"],
    },
  },
});
