import { defineContentType, field } from "@vitnode/core/content";

/**
 * The simplest possible content type: one text field.
 *
 * It exists mostly so `example.article` has something to relate to, which is
 * what proves the `relation` field end to end.
 */
export const categoryContentType = defineContentType({
  id: "example.category",
  tableName: "example_categories",

  fields: {
    name: field.text({ required: true, minLength: 1, maxLength: 100 }),
  },

  admin: {
    label: { plural: "Example Categories", singular: "Example Category" },
    list: {
      columns: ["name", "createdAt"],
      orderableFields: ["name"],
    },
  },
});
