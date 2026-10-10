import { defineContentType, field } from "@vitnode/core/content";

import { blogCategoryContentType } from "./category";

export const blogPostContentType = defineContentType({
  id: "blog.post",
  tableName: "blog_posts",

  localization: {
    defaultLocale: "en",
    // A locale with no translation of its own is served the default language's.
    fallback: "default",
  },

  publication: true,

  editorial: {
    revisions: { retention: 20 },
    preview: { expiresInMinutes: 30 },
    scheduling: true,
  },
  liveEditing: true,

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
    content: field.richText({ localized: true, required: true }),
    excerpt: field.textarea({
      ai: {
        action: "@vitnode/blog:excerpt.generate",
        mode: "suggestion",
        sourceFields: ["title", "content"],
      },
      localized: true,
      nullable: true,
      maxLength: 300,
    }),

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
    path: "blog",
    fields: [
      // Delivery resolves localized alternates by identifier, so a localized
      // delivery content type that withheld `id` would carry an empty alternate
      // set.
      "id",
      "title",
      "friendlyUrl",
      "content",
      "excerpt",
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
    titleField: "title",
    contentFields: ["title", "content"],
    pathTemplate: "/blog/{slug}",
    authorField: "authorId",
  },

  delivery: {
    redirects: true,
    seo: {
      titleField: "title",
      descriptionField: "excerpt",
      fallbackDescriptionField: "content",
    },
    sitemap: { changeFrequency: "weekly", priority: 0.7 },
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
      columns: ["title", "authorId", "status", "publishedAt", "updatedAt"],
      searchableFields: ["title"],
      thumbnailField: "coverImage",
    },
  },
});
