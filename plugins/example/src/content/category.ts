import { defineContentType, field } from "@vitnode/core/content";

export const categoryContentType = defineContentType({
  id: "example.category",
  tableName: "example_categories",

  fields: {
    name: field.text({ required: true, minLength: 1, maxLength: 100 }),
  },

  admin: {
    path: "example/categories",
    list: {
      columns: ["name", "createdAt"],
      orderableFields: ["name"],
    },
  },
});
