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
    /**
     * The **extension-only** reference: a GIF, and nothing else.
     *
     * Both allowlists name exactly one thing, and both have to match, which is
     * what makes this the interesting case:
     *
     * - `banner.gif` declared `image/gif` -> accepted;
     * - `banner.png` declared `image/png` -> refused, wrong extension *and* wrong
     *   type;
     * - a PNG **renamed** to `banner.gif` -> refused, because the browser still
     *   declares `image/png`. An extension-only check would store it;
     * - a real GIF over 10 MB -> refused, before a byte reaches the adapter.
     *
     * A GIF is also the format that proves the storage pipeline is not quietly
     * rewriting the rules: `sharp` deliberately does not re-encode GIF, so the
     * stored file keeps its extension and its animation. An allowlist of `.png`
     * would *not* be safe in the same way - with `storage.image` on, a PNG is
     * converted to WebP, and the field would have to allow `.webp` too.
     *
     * Nullable, which is `field.file`'s default: an article without an animation
     * is the ordinary case.
     */
    animation: field.file({
      maxBytes: 10 * 1024 * 1024,
      allowedExtensions: [".gif"],
      allowedMimeTypes: ["image/gif"],
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
