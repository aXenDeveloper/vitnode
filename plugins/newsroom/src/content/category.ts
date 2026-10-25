import { defineContentType, field } from "@vitnode/core/content";

export const categoryContentType = defineContentType({
  id: "newsroom.category",
  tableName: "newsroom_categories",

  fields: {
    name: field.text({ required: true, minLength: 2, maxLength: 80 }),
    slug: field.slug({ source: "name" }),
  },

  admin: {
    path: "newsroom/categories",
    titleField: "name",
    list: { columns: ["name", "slug", "updatedAt"] },
  },
});
