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
    fields: ["title", "slug", "excerpt", "featured", "category", "publishedAt"],
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
