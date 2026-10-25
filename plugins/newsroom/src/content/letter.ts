import { defineContentType, field } from "@vitnode/core/content";

import { deskContainers } from "@/content/desks";

export const letterContentType = defineContentType({
  id: "newsroom.letter",
  tableName: "newsroom_letters",

  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    body: field.richText({ required: true }),
    author: field.user(),
    desk: field.container({ definition: deskContainers, required: true }),
  },

  publication: true,
  visibility: true,
  editorial: { revisions: { retention: 20 } },
  reports: true,

  publicApi: {
    path: "letters",
    fields: ["id", "title", "slug", "body", "desk", "publishedAt"],
    // A desk's letter list shows titles and dates, never the body.
    listFields: ["id", "title", "slug", "desk", "publishedAt"],
    filterableFields: ["desk"],
    searchableFields: ["title"],
    orderableFields: ["title"],
    people: ["author"],
  },

  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["title", "body", "desk"], status: "published" },
    update: { fields: ["title", "body"] },
  },

  admin: {
    path: "newsroom/letters",
    titleField: "title",
    list: {
      columns: [
        "status",
        "title",
        "slug",
        "desk",
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
