import { defineContentType, field } from "@vitnode/core/content";

import { blogCategoryContentType } from "./category";

export const blogPostContentType = defineContentType({
  id: "blog.post",
  tableName: "blog_posts",

  localization: {
    enabled: true,
    defaultLocale: "en",
    // A locale with no translation of its own is served the default language's.
    fallback: "default",
  },

  publication: { enabled: true },

  editorial: {
    enabled: true,
    revisions: { retention: 20 },
    preview: { enabled: true, expiresInMinutes: 30 },
    scheduling: { enabled: true },
  },

  fields: {
    categoryId: field.relation({
      min: 1,
      multiple: true,
      // Postgres itself refuses to delete a category that still has articles,
      // which is what the plugin's own delete route was trying to be careful
      // about with a `SELECT` first.
      onDelete: "restrict",
      target: () => blogCategoryContentType,
    }),

    authorId: field.user({ min: 1, multiple: true, ordered: true }),

    // Localized: exactly the three variables the plugin kept in
    // `core_languages_words`.
    title: field.text({
      localized: true,
      required: true,
      minLength: 3,
      maxLength: 255,
    }),
    // Derived from the localized title, per language. Kept unique per language,
    // and the addresses it has retired are remembered.
    friendlyUrl: field.slug({
      localized: true,
      maxLength: 255,
      source: "title",
    }),
    content: field.textarea({ localized: true, required: true }),

    coverImage: field.file({
      maxBytes: 5 * 1024 * 1024,
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    }),

    coverImageAlt: field.text({
      localized: true,
      nullable: true,
      maxLength: 255,
    }),
  },

  publicApi: {
    enabled: true,
    path: "blog",
    fields: [
      // Delivery resolves localized alternates by identifier, so a localized
      // delivery content type that withheld `id` would carry an empty alternate
      // set.
      "id",
      "title",
      "friendlyUrl",
      "content",
      "categoryId",
      // A file crosses the public boundary as the normalised descriptor - `{ id,
      // name, url, mimeType, size, width, height }` - and never as the
      // `core_files.id` the column holds: a reader has no route to resolve an
      // identifier through, and the storage key, the uploader and the metadata
      // bag are not part of the shape.
      "coverImage",
      "coverImageAlt",
      "publishedAt",
    ],
    searchableFields: ["title", "content"],
    // Shared columns only: a list ordered by a localized title would reshuffle
    // itself per language, and a cursor would mean two positions at once.
    orderableFields: ["publishedAt"],
    filterableFields: ["categoryId", "friendlyUrl"],
    defaultOrderBy: "publishedAt",
    defaultOrder: "desc",
  },

  search: {
    enabled: true,
    titleField: "title",
    contentFields: ["title", "content"],
    pathTemplate: "/{locale}/blog/{slug}",
  },

  delivery: {
    enabled: true,
    redirects: { enabled: true },
    seo: { titleField: "title", descriptionField: "content" },
    sitemap: { enabled: true, changeFrequency: "weekly", priority: 0.7 },
    hreflang: { xDefault: "defaultLocale" },
  },

  indexes: [{ on: ["status", "createdAt"] }],

  admin: {
    // "Article" in the AdminCP - the noun is `@vitnode/blog.content.post.label`,
    // an ICU plural resolved per language. `blog.post` in the database and the
    // API, which is what this module name would have been derived from.
    permissionModule: "posts",
    // The URL says what the screen says: `/admin/content/blog/articles`, plural,
    // because it is a list of them. The id it would otherwise be derived from
    // stays `blog.post`, which is the half nobody types.
    path: "blog/articles",
    // The localized title, resolved in the reader's own language - the same
    // display projection the category uses. It is not a base-table column and it
    // never becomes one: `orderableFields` is untouched, and a list sorted by a
    // per-language value would reshuffle itself per reader.
    titleField: "title",
    // The page-mode reference. Both actions, so a create hands straight over to
    // the article's own edit page.
    create: { mode: "page" },
    edit: { mode: "page" },
    list: {
      // Scalar columns only, which is why neither the categories nor the
      // authors are here: both are sets on generated junction tables, and a
      // list that loaded them would issue a query per row. The form carries
      // them, which is where they are edited anyway.
      // The title still leads - it is what somebody scans a list by. `coverImage`
      // sits beside it and renders as a thumbnail plus the stored file name,
      // never as the identifier the column holds: a raw `42` is the one thing an
      // editor cannot recognise.
      columns: ["title", "coverImage", "status", "publishedAt", "updatedAt"],
    },
  },
});
