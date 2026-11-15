// The fixtures core's own frontend tests use. The API keeps the full set in
// `packages/api/src/tests/content-fixtures.ts`.

import type { LocaleRoutingConfig } from "@vitnode/api/lib/i18n/locale-routing";

import { defineContentType } from "@vitnode/api/content/define";
import { field } from "@vitnode/api/content/fields";
import { createLocaleRouting } from "@vitnode/api/lib/i18n/locale-routing";

export const testContentLocaleRouting = (
  config: Partial<LocaleRoutingConfig> = {},
) =>
  createLocaleRouting({
    defaultLocale: "en",
    locales: ["en", "pl"],
    ...config,
  });

export const testCategoryContentType = defineContentType({
  id: "test.category",
  tableName: "test_categories",
  fields: {
    title: field.text({ required: true, minLength: 1, maxLength: 100 }),
  },
});

/**
 * Stage 1 shape, kept deliberately unchanged: it declares its own `status` and
 * `publishedAt` fields, so it doubles as the backward-compatibility fixture.
 */
export const testArticleContentType = defineContentType({
  id: "test.article",
  tableName: "test_articles",
  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    excerpt: field.textarea({ maxLength: 500, nullable: true }),
    views: field.number({ integer: true, min: 0, defaultValue: 0 }),
    featured: field.boolean({ defaultValue: false }),
    status: field.enum({
      values: ["draft", "published", "archived"],
      defaultValue: "draft",
    }),
    publishedAt: field.dateTime({ nullable: true }),
    author: field.user({ nullable: true, onDelete: "set null" }),
    category: field.relation({
      required: true,
      onDelete: "restrict",
      target: () => testCategoryContentType,
    }),
  },
  indexes: [{ on: ["status", "createdAt"] }],
  admin: {
    titleField: "title",
    list: {
      columns: ["title", "status", "author", "updatedAt"],
      searchableFields: ["title", "excerpt"],
      orderableFields: ["title", "status"],
      defaultOrderBy: "updatedAt",
      defaultOrder: "desc",
    },
  },
});

/**
 * The Stage 2 shape: `status` and `publishedAt` come from `publication`, and
 * the URL segment from a `slug` field derived from the title.
 */
export const testPostContentType = defineContentType({
  id: "test.post",
  tableName: "test_posts",
  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    excerpt: field.textarea({ maxLength: 500, nullable: true }),
    views: field.number({ integer: true, min: 0, defaultValue: 0 }),
    author: field.user(),
    category: field.relation({
      required: true,
      onDelete: "restrict",
      target: () => testCategoryContentType,
    }),
  },
  publication: true,
  // `views` and `author` are deliberately absent from `fields`: they are the
  // "a private field never leaves Postgres" assertion in the public tests.
  publicApi: {
    path: "posts",
    fields: ["title", "slug", "excerpt", "category", "publishedAt"],
    searchableFields: ["title", "excerpt"],
    orderableFields: ["publishedAt", "title"],
    filterableFields: ["category"],
    defaultOrderBy: "publishedAt",
    defaultOrder: "desc",
  },
  admin: {
    titleField: "title",
    list: {
      searchableFields: ["title", "excerpt"],
      orderableFields: ["title"],
      defaultOrderBy: "publishedAt",
    },
  },
});

export const testLocalizedArticleContentType = defineContentType({
  id: "test.localized",
  tableName: "test_localized_articles",
  localization: {
    defaultLocale: "en",
    fallback: "none",
  },
  fields: {
    title: field.text({
      localized: true,
      required: true,
      minLength: 3,
      maxLength: 200,
    }),
    slug: field.slug({ localized: true, source: "title" }),
    body: field.textarea({ localized: true, nullable: true }),
    // Shared, and deliberately the only one: "a localized field is absent from
    // the base table" needs something present there to be contrasted with.
    featured: field.boolean({ defaultValue: false }),
    views: field.number({ integer: true, min: 0, defaultValue: 0 }),
  },
  admin: {
    list: { columns: ["featured", "views"], orderableFields: ["views"] },
  },
});

export const testLocalizedGuideContentType = defineContentType({
  id: "test.localized-guide",
  tableName: "test_localized_guides",
  editorial: { revisions: { retention: 5 } },
  liveEditing: true,
  localization: { defaultLocale: "en", fallback: "default" },
  publication: true,
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    body: field.textarea({ localized: true, nullable: true }),
    summary: field.text({ localized: true, nullable: true, maxLength: 300 }),
    featured: field.boolean({ defaultValue: false }),
  },
  admin: {
    list: { columns: ["featured", "status"] },
  },
});

export const testAdvancedLocalizedContentType = defineContentType({
  id: "test.advanced-localized",
  tableName: "test_advanced_localized",
  localization: { defaultLocale: "en", fallback: "default" },
  publication: true,
  editorial: true,
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    // Localized whole: both leaves live on the translation table, and a
    // translation revision has to record them nested.
    seo: field.group({
      localized: true,
      nullable: true,
      fields: {
        title: field.text({ nullable: true, maxLength: 200 }),
        description: field.textarea({ nullable: true }),
      },
    }),
    featured: field.boolean({ defaultValue: false }),
    // Shared, like every Stage 6 repeatable - so every locale's document is
    // built from the same children, and all of them have to contain them.
    faq: field.repeatable({
      fields: {
        question: field.text({ required: true, maxLength: 200 }),
        answer: field.textarea({ required: true }),
      },
    }),
  },
  publicApi: {
    path: "advanced-localized",
    fields: [
      "title",
      "slug",
      "seo.title",
      "seo.description",
      "faq.question",
      "faq.answer",
      "featured",
      "publishedAt",
    ],
    searchableFields: ["title"],
    orderableFields: ["publishedAt"],
  },
  search: {
    titleField: "title",
    descriptionField: "seo.description",
    contentFields: ["title", "seo.description", "faq.question", "faq.answer"],
    pathTemplate: "/{locale}/advanced-localized/{slug}",
  },
  admin: {
    list: { columns: ["featured", "status"] },
  },
});

export const testDeliveredPostContentType = defineContentType({
  id: "test.delivered-post",
  tableName: "test_delivered_posts",
  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    excerpt: field.textarea({ maxLength: 500, nullable: true }),
    hidden: field.boolean({ defaultValue: false }),
  },
  publication: true,
  editorial: true,
  publicApi: {
    path: "delivered-posts",
    fields: ["id", "title", "slug", "excerpt", "hidden", "publishedAt"],
    defaultOrderBy: "publishedAt",
  },
  delivery: {
    redirects: true,
    seo: {
      titleField: "title",
      descriptionField: "excerpt",
      noIndexField: "hidden",
      openGraph: { titleField: "title", descriptionField: "excerpt" },
    },
    sitemap: { changeFrequency: "weekly", priority: 0.7 },
  },
});

export const testDeliveredLocalizedContentType = defineContentType({
  id: "test.delivered-localized",
  tableName: "test_delivered_localized",
  localization: { defaultLocale: "en", fallback: "default" },
  publication: true,
  editorial: true,
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    seo: field.group({
      localized: true,
      nullable: true,
      fields: {
        title: field.text({ nullable: true, maxLength: 200 }),
        description: field.textarea({ nullable: true, maxLength: 500 }),
      },
    }),
  },
  publicApi: {
    path: "delivered-localized",
    fields: [
      "id",
      "title",
      "slug",
      "seo.title",
      "seo.description",
      "publishedAt",
    ],
    defaultOrderBy: "publishedAt",
  },
  delivery: {
    redirects: true,
    hreflang: { xDefault: "defaultLocale" },
    seo: {
      titleField: "seo.title",
      fallbackTitleField: "title",
      descriptionField: "seo.description",
    },
    sitemap: { changeFrequency: "daily", priority: 0.5 },
  },
  admin: {
    list: { columns: ["status", "updatedAt"] },
  },
});

export const testSectionedContentType = defineContentType({
  id: "test.sectioned",
  tableName: "test_sectioned",
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    excerpt: field.textarea({ nullable: true }),
    featured: field.boolean({ defaultValue: false }),
    views: field.number({ integer: true, defaultValue: 0 }),
  },
  admin: {
    titleField: "title",
    form: {
      sections: [
        { name: "general", fields: ["title", "excerpt"] },
        // `views` is in no section, so the form does not have it at all.
        { name: "visibility", fields: ["featured"] },
      ],
    },
  },
});

export const testFileGalleryContentType = defineContentType({
  id: "test.file-gallery",
  tableName: "test_file_galleries",
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    // The single-file field, kept beside the gallery: every rule that has to hold
    // "per field rather than per row" needs both arities in one content type.
    cover: field.file({
      maxBytes: 5 * 1024 * 1024,
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    }),
    gallery: field.file({
      multiple: true,
      min: 1,
      max: 4,
      maxBytes: 5 * 1024 * 1024,
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    }),
    // Unordered on purpose, so "the stored order is ascending file id" has
    // something to be true of - the gallery above proves the other branch.
    attachments: field.file({
      multiple: true,
      ordered: false,
      maxBytes: 20 * 1024 * 1024,
      allowedExtensions: [".pdf"],
      allowedMimeTypes: ["application/pdf"],
    }),
  },
  publication: true,
  editorial: { revisions: { retention: 5 } },
  publicApi: {
    path: "file-galleries",
    fields: ["title", "slug", "cover", "gallery", "publishedAt"],
  },
  admin: {
    titleField: "title",
    // The gallery is deliberately absent: it is not one column, so
    // `admin.list.columns` refuses it and the list response loads no junction.
    list: { columns: ["cover", "title", "status", "updatedAt"] },
  },
});

export const testForumContentType = defineContentType({
  id: "test.forum",
  tableName: "test_forums",
  publication: true,
  visibility: true,
  fields: {
    title: field.text({ required: true, maxLength: 100 }),
    slug: field.slug({ source: "title" }),
  },
  publicApi: {
    path: "forums",
    fields: ["id", "title", "slug", "publishedAt"],
  },
});

export const testTopicContentType = defineContentType({
  id: "test.topic",
  tableName: "test_topics",
  publication: true,
  visibility: true,
  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    body: field.richText({ required: true, maxBytes: 2000 }),
    pinned: field.boolean({ defaultValue: false }),
    author: field.user(),
    forum: field.relation({
      required: true,
      onDelete: "restrict",
      target: () => testForumContentType,
    }),
  },
  publicApi: {
    path: "topics",
    fields: ["id", "title", "slug", "forum", "publishedAt"],
  },
  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["title", "body", "forum"], status: "published" },
    update: { fields: ["title", "body", "forum"] },
  },
});
