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

  // Opt-in, and separate from `publication` on purpose: publishing controls
  // what staff can see in the AdminCP badge, this controls what the internet
  // can read. `code`, `views` and `author` are absent, so they never leave
  // Postgres - the author especially, since a user field resolves to a person.
  publicApi: {
    enabled: true,
    path: "articles",
    fields: ["title", "slug", "excerpt", "featured", "category", "publishedAt"],
    searchableFields: ["title", "excerpt"],
    orderableFields: ["publishedAt", "title"],
    filterableFields: ["category", "featured"],
    defaultOrderBy: "publishedAt",
    defaultOrder: "desc",
  },

  // Published articles are kept in the site-wide search index automatically:
  // publishing adds the document, editing an indexed field or the slug rewrites
  // it, unpublishing and deleting remove it. Drafts are never indexed.
  //
  // Every field named here is also in `publicApi.fields` - that is enforced by
  // the types, not just by review. Naming `code` or `author` would not compile,
  // which is what stops a private value surfacing in a result snippet.
  search: {
    enabled: true,
    titleField: "title",
    descriptionField: "excerpt",
    contentFields: ["title", "excerpt"],
    pathTemplate: "/articles/{slug}",
  },

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
