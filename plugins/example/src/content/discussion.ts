import { defineContentType, field } from "@vitnode/core/content";

import { boardContainers } from "@/content/boards";

export const discussionContentType = defineContentType({
  id: "example.discussion",
  tableName: "example_discussions",

  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    body: field.richText({ required: true }),
    author: field.user(),
    board: field.container({ definition: boardContainers, required: true }),
  },

  publication: true,
  visibility: true,
  editorial: { revisions: { retention: 20 } },
  reports: true,

  publicApi: {
    path: "discussions",
    fields: ["id", "title", "slug", "body", "board", "publishedAt"],
    // A board's discussion list shows titles and dates, never the body.
    listFields: ["id", "title", "slug", "board", "publishedAt"],
    filterableFields: ["board"],
    searchableFields: ["title"],
    orderableFields: ["title"],
    people: ["author"],
  },

  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["title", "body", "board"], status: "published" },
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
        "board",
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
