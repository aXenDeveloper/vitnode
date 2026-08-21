import { defineContentType, field } from "@vitnode/core/content";

import { blogCategoryContentType } from "./category";

/**
 * Blog articles, as a Content Engine content type.
 *
 * The **rich** reference implementation: page-mode create and edit, a custom
 * AdminCP layout, `AutoFormEditor` for the body, a native relation to the
 * category, an author, publication, editorial history, search and delivery.
 * Everything a real CMS entry needs, and not one line of bespoke CRUD.
 *
 * The id stays `blog.post` and the table stays `blog_posts`. "Article" is what
 * the AdminCP calls it, because that is what people call it - but the content
 * type id is part of the event names, the permission keys and the admin URL, and
 * renaming a public contract for a nicer noun is churn with no payer.
 *
 * The field names are the column names the plugin already had: `categoryId` and
 * `authorId`, not `category` and `author`. The engine names a column after its
 * field, so keeping the field names keeps the columns, the foreign keys and
 * their constraint names exactly where they are.
 */
export const blogPostContentType = defineContentType({
  id: "blog.post",
  tableName: "blog_posts",

  localization: {
    enabled: true,
    defaultLocale: "en",
    // A locale with no translation of its own is served the default language's,
    // which is what the plugin's own `resolveLangValue` did by hand.
    fallback: "default",
  },

  /**
   * Draft and published, which the blog did not have and now does.
   *
   * Every article that exists today is publicly readable - the old public route
   * returned every row and the search index marked every document
   * `isPublic: true` - so the migration backfills them all as published, with
   * `publishedAt` set to `createdAt`. That is the one publication fact the old
   * schema can actually prove; nothing else about their history is invented.
   */
  publication: { enabled: true },

  /**
   * Versions, revisions, preview links and scheduling.
   *
   * `editorial` is also what `delivery.redirects` is gated on: slug history has
   * to be written in the same transaction as the slug change, and only the
   * editorial mutation paths own such a transaction. An article's URL is the
   * thing most worth not breaking, so both are on.
   */
  editorial: {
    enabled: true,
    revisions: { retention: 20 },
    preview: { enabled: true, expiresInMinutes: 30 },
    scheduling: { enabled: true },
  },

  fields: {
    /**
     * Which categories an article is in - **many**, and the field name stays
     * singular because it is the API key, the event key and the message key
     * every existing client already reads. Its column is gone either way: a set
     * lives in `blog_posts_category_id`, one row per membership.
     *
     * Unordered: an article filed under both "Releases" and "Engineering" is not
     * more one than the other, so the engine stores the set in ascending id
     * order and nobody has to maintain an order that means nothing.
     *
     * **Not `required`, and it cannot be** - a to-many reference is never
     * required, because the empty set is what "no categories" looks like to a
     * junction table. `min: 1` is the rule the blog actually wants, and it is a
     * rule about the *article*: an article has to be filed somewhere. It is
     * enforced by the generated schema, so the API answers 400 and the AdminCP
     * form refuses to submit - rather than by a check one of the two would skip.
     */
    categoryId: field.relation({
      min: 1,
      multiple: true,
      // Postgres itself refuses to delete a category that still has articles,
      // which is what the plugin's own delete route was trying to be careful
      // about with a `SELECT` first.
      onDelete: "restrict",
      target: () => blogCategoryContentType,
    }),
    /**
     * Who wrote it - **many**, and ordered, because a byline is a sentence: "by
     * Ada and Grace" is not the same as "by Grace and Ada", and the first name
     * on a piece is a thing people care about.
     *
     * `min: 1`, for the same reason the categories have it: an article with no
     * byline is not a state the blog wants, and a to-many field cannot say that
     * with `required`.
     *
     * `onDelete` defaults to `cascade` here rather than the `set null` a single
     * author had: a junction row has no column to null, so forgetting a deleted
     * account's authorship means deleting the membership. The article survives
     * either way, which is what the nullable column was protecting.
     */
    authorId: field.user({ min: 1, multiple: true, ordered: true }),

    // Localized: exactly the three variables the plugin kept in
    // `core_languages_words`.
    title: field.text({
      localized: true,
      required: true,
      minLength: 3,
      maxLength: 255,
    }),
    // Derived from the localized title, per language - which is what
    // `TitleField` did in the browser, except the engine also keeps it unique
    // per language and remembers the addresses it has retired.
    friendlyUrl: field.slug({
      localized: true,
      maxLength: 255,
      source: "title",
    }),
    content: field.textarea({ localized: true, required: true }),

    /**
     * The article's cover image - **shared**, and one file.
     *
     * The column is a `core_files.id` with `ON DELETE RESTRICT`, so Postgres
     * itself refuses to delete an image an article is still using, and nothing
     * about the file is copied onto the row: no URL, no storage key, no size. One
     * fact in one place, which is what makes replacing the image a single write.
     *
     * `maxBytes` is mandatory on every file field and this one says five
     * megabytes. Both allowlists are stated, and they have to *both* match: a
     * `hero.png` declared `image/gif` is refused, which an extension-only check
     * would wave through.
     *
     * `.webp` is in the extension list for a reason worth knowing: with
     * `storage.image` configured, VitNode re-encodes uploaded images to WebP, so
     * the stored file is `hero.webp` whatever was chosen. A field that allowed
     * only `.png` would accept the upload and then refuse the save.
     *
     * Not localized, and it cannot be: a cover image is one image whatever
     * language somebody reads the article in. The *alt text* is the part that
     * differs, and that is the field below.
     */
    coverImage: field.file({
      maxBytes: 5 * 1024 * 1024,
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    }),
    /**
     * What a screen reader says instead of the cover image - **per language**.
     *
     * The pairing is the point: one shared file, one localized description of it.
     * `nullable: true` because an article with no cover has nothing to describe,
     * and because alt text is written after the image is chosen rather than at
     * the same moment.
     */
    coverImageAlt: field.text({
      localized: true,
      nullable: true,
      maxLength: 255,
    }),
  },

  /**
   * The public read layer.
   *
   * `path: "blog"` keeps the public URL shape the plugin already published under
   * - `/blog/...` - now as a canonical delivery address the engine owns.
   *
   * `authorId` is **not** exposed, and cannot be: a `user` field is not one of
   * the publicly exposable kinds, because publishing a staff account's display
   * name is a decision the core users table gets to make rather than a side
   * effect of an article having an author.
   */
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

  /**
   * One search document per published translation.
   *
   * Replaces `api/lib/search.ts` entirely. That file emitted one document per
   * *enabled language* whether or not a translation existed, falling back to the
   * default language's copy - so a Polish search could return an English article
   * at a Polish URL. The engine indexes translations that actually exist, which
   * is both less code and a better answer.
   */
  search: {
    enabled: true,
    titleField: "title",
    contentFields: ["title", "content"],
    pathTemplate: "/{locale}/blog/{slug}",
  },

  /**
   * Canonical URLs, slug history, redirects, SEO and the sitemap.
   *
   * `redirects` is the reason the old friendly-URL uniqueness check is gone:
   * the engine reserves every address an article has ever been published at, so
   * renaming one 308s the old URL instead of leaving it dead - and a second
   * article cannot quietly claim an address the first one still redirects from.
   */
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
