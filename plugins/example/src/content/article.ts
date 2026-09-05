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

    noIndex: field.boolean({ nullable: true }),
    author: field.user(),

    animation: field.file({
      maxBytes: 10 * 1024 * 1024,
      allowedExtensions: [".gif"],
      allowedMimeTypes: ["image/gif"],
    }),

    gallery: field.file({
      multiple: true,
      min: 1,
      max: 8,
      maxBytes: 5 * 1024 * 1024,
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    }),
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
      // Publicly exposed as the normalised descriptor - `{ id, name, url,
      // mimeType, size, width, height }` - never as the `core_files.id` the
      // column holds, and never with the storage key or the uploader.
      "animation",
      // The same descriptor, once per image, in the order the editor arranged -
      // so a reader gets a gallery it can render rather than a list of integers
      // it has no route to resolve.
      "gallery",
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
    // `/admin/content/example/articles` - plural, like the list it opens. The id
    // stays singular because it names one record, and nobody types it.
    path: "example/articles",
    titleField: "title",
    list: {
      columns: [
        "status",
        "title",
        "slug",
        "code",
        "category",
        "author",
        // Rendered as a thumbnail and the stored file name, not as the
        // identifier the column holds.
        "animation",
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
