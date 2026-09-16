import { defineContentType, field } from "@vitnode/core/content";

import { PAGE_BLOCKS_ALLOWED } from "./page-blocks";

export const pageContentType = defineContentType({
  id: "example.page",
  tableName: "example_pages",

  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),

    content: field.blocks({
      allowed: PAGE_BLOCKS_ALLOWED,
      max: 50,
    }),
  },

  publication: { enabled: true },

  publicApi: {
    enabled: true,
    path: "pages",
    fields: ["title", "slug", "content", "publishedAt"],
  },

  admin: {
    titleField: "title",
    list: {
      orderableFields: ["title"],
      searchableFields: ["title"],
    },
  },
});
