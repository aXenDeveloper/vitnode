import { defineContentType, field } from "@vitnode/core/content";

import { categoryContentType } from "./category";

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
    /**
     * The Stage 8 `noIndexField`, and **nullable** on purpose.
     *
     * `example.advanced-article` models the other shape - a `NOT NULL` boolean
     * with a default - so between the two every state a `noIndexField` can be in
     * is exercised against real Postgres. Nullable is the one that matters,
     * because `null` has to mean the same thing in two places at once: the
     * `robots` metadata reads `value !== true`, and the sitemap predicate has to
     * agree with it. A column added to an existing table arrives full of nulls,
     * so this is also what an upgrade actually looks like.
     */
    noIndex: field.boolean({ nullable: true }),
    author: field.user(),
    category: field.relation({
      required: true,
      onDelete: "restrict",
      target: () => categoryContentType,
    }),
  },

  publication: { enabled: true },

  publicApi: {
    enabled: true,
    path: "articles",
    fields: [
      "title",
      "slug",
      "excerpt",
      "featured",
      "category",
      // Public because delivery projects it: `robots: { index: false }` is
      // rendered into the page, so the field behind it has to be one the public
      // API would already have said out loud.
      "noIndex",
      "publishedAt",
    ],
    searchableFields: ["title", "excerpt"],
    orderableFields: ["publishedAt", "title"],
    filterableFields: ["category", "featured"],
    defaultOrderBy: "publishedAt",
    defaultOrder: "desc",
  },

  search: {
    enabled: true,
    titleField: "title",
    descriptionField: "excerpt",
    contentFields: ["title", "excerpt"],
    pathTemplate: "/articles/{slug}",
  },

  /**
   * The Stage 8 reference for a **nonlocalized** content type.
   *
   * Its canonical path has no locale segment - `/articles/my-article` - and its slug
   * history has no language either: `languageId` is `NULL`, so one reservation
   * covers the one URL the record has.
   *
   * `redirects` is what makes an old address keep working. Change the slug of a
   * *published* article and `/articles/old-slug` answers 308 to the new one, for as
   * long as the article stays published; change it while it is still a draft and
   * nothing is recorded, because the URL was never live.
   *
   * `seo` projects two fields the public API already exposes. There is no
   * `fallbackTitleField` here because `title` is the primary and it is
   * `required: true` - a fallback would never be reached.
   */
  delivery: {
    enabled: true,
    redirects: { enabled: true },
    seo: {
      titleField: "title",
      descriptionField: "excerpt",
      // Nullable, so `null` and `false` both mean "list it and let it be indexed"
      // while only `true` withholds it. One boolean drives the `robots` metadata
      // and the sitemap predicate together, which is what stops the page saying
      // `index: true` while the sitemap quietly leaves it out.
      noIndexField: "noIndex",
      // Same fields in both slots, which is the common case: an author who wants a
      // different social title names a different field, and one who does not says
      // so in two lines rather than four.
      openGraph: { titleField: "title", descriptionField: "excerpt" },
    },
    sitemap: { enabled: true, changeFrequency: "weekly", priority: 0.7 },
  },

  editorial: {
    enabled: true,
    revisions: { retention: 20 },
    preview: { enabled: true, expiresInMinutes: 30 },
    scheduling: { enabled: true },
  },

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
