import { defineContentType, field } from "@vitnode/core/content";

import { categoryContentType } from "./category";

/**
 * Exercises every field kind the Content Engine supports, plus the draft ->
 * published lifecycle.
 *
 * `status` and `publishedAt` are *not* declared here: `publication` generates
 * them, and declaring either alongside it is a define-time error. They are
 * read-only on the wire - `service.publish` / `service.unpublish` and the two
 * generated routes are the only things that move them.
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
    // Derived from the title when the payload omits it, and never re-derived
    // afterwards - renaming an article does not move its URL.
    slug: field.slug({ source: "title" }),
    // `unique: true` is all it takes to get a unique index in the migration.
    code: field.text({ required: true, maxLength: 100, unique: true }),
    excerpt: field.textarea({ maxLength: 500, nullable: true }),
    views: field.number({ integer: true, min: 0, defaultValue: 0 }),
    featured: field.boolean({ defaultValue: false }),
    author: field.user(),
    category: field.relation({
      required: true,
      onDelete: "restrict",
      target: () => categoryContentType,
    }),
  },

  publication: { enabled: true },

  // The generated columns are addressable here too. `(status, publishedAt)` is
  // generated automatically; this one backs "newest drafts first".
  indexes: [{ on: ["status", "createdAt"] }],

  admin: {
    label: { plural: "Example Articles", singular: "Example Article" },
    titleField: "title",
    list: {
      columns: [
        "status",
        "title",
        "slug",
        "code",
        "category",
        "author",
        "publishedAt",
        "updatedAt",
      ],
      searchableFields: ["title", "code", "excerpt"],
      orderableFields: ["title", "code", "slug"],
      defaultOrderBy: "updatedAt",
      defaultOrder: "desc",
    },
  },
});
