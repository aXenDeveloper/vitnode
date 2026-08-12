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
    // Shared: which category an article is in, and who wrote it, are properties
    // of the article rather than of a language.
    categoryId: field.relation({
      required: true,
      // Postgres itself refuses to delete a category that still has articles,
      // which is what the plugin's own delete route was trying to be careful
      // about with a `SELECT` first.
      onDelete: "restrict",
      target: () => blogCategoryContentType,
    }),
    authorId: field.user(),

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
    // "Article" in the AdminCP, `blog.post` in the database and the API.
    label: { plural: "Articles", singular: "Article" },
    permissionModule: "posts",
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
      columns: [
        "title",
        "status",
        "categoryId",
        "authorId",
        "publishedAt",
        "updatedAt",
      ],
    },
  },
});
