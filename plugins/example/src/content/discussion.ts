import { defineContentType, field } from "@vitnode/core/content";

export const discussionContentType = defineContentType({
  id: "example.discussion",
  tableName: "example_discussions",

  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    body: field.richText({ required: true }),
    author: field.user(),
  },

  publication: true,
  visibility: true,
  editorial: { revisions: { retention: 20 } },

  publicApi: {
    path: "discussions",
    fields: ["id", "title", "slug", "body", "publishedAt"],
  },

  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["title", "body"], status: "published" },
    update: { fields: ["title", "body"] },
  },

  admin: {
    path: "example/discussions",
    titleField: "title",
    list: {
      columns: [
        "status",
        "title",
        "slug",
        "author",
        "publishedAt",
        "updatedAt",
      ],
      searchableFields: ["title"],
      orderableFields: ["title", "slug"],
      defaultOrderBy: "updatedAt",
      defaultOrder: "desc",
    },
  },
});
