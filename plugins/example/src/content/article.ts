import { defineContentType, field } from "@vitnode/core/content";

import { categoryContentType } from "./category";

/**
 * Exercises every field kind the Content Engine supports in MVP 1.
 *
 * Client-safe by construction - zod and plain objects only - so the same object
 * is imported by `config.tsx` (the AdminCP), by `config.api.ts` (the routes and
 * permissions) and by `src/database/articles.ts` (the Drizzle table).
 */
export const articleContentType = defineContentType({
  id: "example.article",
  tableName: "example_articles",

  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    excerpt: field.textarea({ maxLength: 500, nullable: true }),
    views: field.number({ integer: true, min: 0, defaultValue: 0 }),
    featured: field.boolean({ defaultValue: false }),
    status: field.enum({
      values: ["draft", "published", "archived"],
      defaultValue: "draft",
    }),
    publishedAt: field.dateTime({ nullable: true }),
    author: field.user({ nullable: true, onDelete: "set null" }),
    category: field.relation({
      required: true,
      onDelete: "restrict",
      target: () => categoryContentType,
    }),
  },

  indexes: [{ on: ["status", "createdAt"] }],

  admin: {
    label: { plural: "Example Articles", singular: "Example Article" },
    titleField: "title",
    list: {
      columns: ["title", "status", "category", "author", "updatedAt"],
      searchableFields: ["title", "excerpt"],
      orderableFields: ["title", "status"],
      defaultOrderBy: "updatedAt",
      defaultOrder: "desc",
    },
  },
});
