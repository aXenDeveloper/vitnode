import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";

export const testCategoryContentType = defineContentType({
  id: "test.category",
  tableName: "test_categories",
  fields: {
    title: field.text({ required: true, minLength: 1, maxLength: 100 }),
  },
});

export const testLocalizedCategoryContentType = defineContentType({
  id: "test.localized-category",
  tableName: "test_localized_categories",
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  fields: {
    color: field.text({ maxLength: 50, nullable: true }),
    name: field.text({
      localized: true,
      required: true,
      minLength: 1,
      maxLength: 100,
    }),
  },
  admin: {
    titleField: "name",
    list: { columns: ["name", "color"] },
  },
});

export const testLocalizedRelationArticleContentType = defineContentType({
  id: "test.localized-relation",
  tableName: "test_localized_relation_articles",
  fields: {
    title: field.text({ required: true, minLength: 1, maxLength: 200 }),
    category: field.relation({
      required: true,
      onDelete: "restrict",
      target: () => testLocalizedCategoryContentType,
    }),
  },
  admin: {
    titleField: "title",
    list: { columns: ["title", "category"] },
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
  publication: { enabled: true },
  // `views` and `author` are deliberately absent from `fields`: they are the
  // "a private field never leaves Postgres" assertion in the public tests.
  publicApi: {
    enabled: true,
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

export const testEditorialPostContentType = defineContentType({
  id: "test.editorial",
  tableName: "test_editorial_posts",
  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    excerpt: field.textarea({ maxLength: 500, nullable: true }),
    views: field.number({ integer: true, min: 0, defaultValue: 0 }),
  },
  publication: { enabled: true },
  publicApi: {
    enabled: true,
    path: "editorial",
    fields: ["title", "slug", "excerpt", "publishedAt"],
    defaultOrderBy: "publishedAt",
  },
  editorial: {
    enabled: true,
    revisions: { retention: 10 },
    preview: {
      enabled: true,
      expiresInMinutes: 30,
      pathTemplate: "/editorial/preview/{token}",
    },
    scheduling: { enabled: true },
  },
  admin: {
    titleField: "title",
    list: {
      columns: ["status", "title", "version"],
      defaultOrderBy: "version",
    },
  },
});

export const testEditorialNoteContentType = defineContentType({
  id: "test.note",
  tableName: "test_notes",
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    body: field.textarea({ nullable: true }),
  },
  editorial: { enabled: true },
});

export const testSearchablePostContentType = defineContentType({
  id: "test.searchable",
  tableName: "test_searchable_posts",
  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    excerpt: field.textarea({ maxLength: 500, nullable: true }),
    body: field.textarea({ nullable: true }),
    code: field.text({ required: true, maxLength: 100 }),
    views: field.number({ integer: true, min: 0, defaultValue: 0 }),
    author: field.user(),
  },
  publication: { enabled: true },
  publicApi: {
    enabled: true,
    path: "searchable",
    fields: ["title", "slug", "excerpt", "body", "publishedAt"],
    defaultOrderBy: "publishedAt",
  },
  search: {
    enabled: true,
    titleField: "title",
    descriptionField: "excerpt",
    contentFields: ["excerpt", "body"],
    pathTemplate: "/searchable/{slug}",
  },
  admin: {
    titleField: "title",
    list: { defaultOrderBy: "publishedAt" },
  },
});

export const testLocalizedArticleContentType = defineContentType({
  id: "test.localized",
  tableName: "test_localized_articles",
  localization: {
    enabled: true,
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

export const testLocalizedNoteContentType = defineContentType({
  id: "test.localized-note",
  tableName: "test_localized_notes",
  localization: { enabled: true, defaultLocale: "EN" },
  fields: {
    heading: field.text({ localized: true, required: true }),
    slug: field.slug({ localized: true }),
    pinned: field.boolean({ defaultValue: false }),
  },
});

export const testLocalizedGuideContentType = defineContentType({
  id: "test.localized-guide",
  tableName: "test_localized_guides",
  editorial: { enabled: true, revisions: { retention: 5 } },
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  publication: { enabled: true },
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

export const testLocalizedPageContentType = defineContentType({
  id: "test.localized-page",
  tableName: "test_localized_pages",
  editorial: {
    enabled: true,
    preview: { enabled: true, expiresInMinutes: 30 },
    revisions: { retention: 5 },
  },
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  publication: { enabled: true },
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    body: field.textarea({ localized: true, nullable: true }),
    featured: field.boolean({ defaultValue: false }),
  },
  publicApi: {
    enabled: true,
    path: "localized-pages",
    fields: ["title", "slug", "body", "featured", "publishedAt"],
    searchableFields: ["title", "body"],
    // Shared only, and that is the rule: a localized column is not on the base
    // table, and a list ordered by one would reshuffle per language.
    orderableFields: ["publishedAt"],
    filterableFields: ["featured", "slug"],
    defaultOrderBy: "publishedAt",
    defaultOrder: "desc",
  },
  admin: {
    list: { columns: ["featured", "status"] },
  },
});

/** The same shape with `fallback: "none"`, for the refusal half of the rules. */
export const testStrictLocalizedPageContentType = defineContentType({
  id: "test.strict-localized-page",
  tableName: "test_strict_localized_pages",
  localization: { enabled: true, defaultLocale: "en", fallback: "none" },
  publication: { enabled: true },
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    featured: field.boolean({ defaultValue: false }),
  },
  publicApi: {
    enabled: true,
    path: "strict-localized-pages",
    fields: ["title", "slug", "featured", "publishedAt"],
    searchableFields: ["title"],
    orderableFields: ["publishedAt"],
    filterableFields: ["featured"],
  },
  admin: {
    list: { columns: ["featured", "status"] },
  },
});

export const testLocalizedSearchPageContentType = defineContentType({
  id: "test.localized-search-page",
  tableName: "test_localized_search_pages",
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  publication: { enabled: true },
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    body: field.textarea({ localized: true, nullable: true }),
    featured: field.boolean({ defaultValue: false }),
  },
  publicApi: {
    enabled: true,
    path: "pages",
    fields: ["title", "slug", "body", "featured", "publishedAt"],
    searchableFields: ["title", "body"],
    orderableFields: ["publishedAt"],
    filterableFields: ["featured"],
  },
  search: {
    enabled: true,
    titleField: "title",
    contentFields: ["title", "body"],
    pathTemplate: "/{locale}/pages/{slug}",
  },
  admin: {
    list: { columns: ["featured", "status"] },
  },
});

export const testAdvancedLocalizedContentType = defineContentType({
  id: "test.advanced-localized",
  tableName: "test_advanced_localized",
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  publication: { enabled: true },
  editorial: { enabled: true },
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
    enabled: true,
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
    enabled: true,
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
  publication: { enabled: true },
  editorial: { enabled: true },
  publicApi: {
    enabled: true,
    path: "delivered-posts",
    fields: ["id", "title", "slug", "excerpt", "hidden", "publishedAt"],
    defaultOrderBy: "publishedAt",
  },
  delivery: {
    enabled: true,
    redirects: { enabled: true },
    seo: {
      titleField: "title",
      descriptionField: "excerpt",
      noIndexField: "hidden",
      openGraph: { titleField: "title", descriptionField: "excerpt" },
    },
    sitemap: { enabled: true, changeFrequency: "weekly", priority: 0.7 },
  },
});

export const testDeliveredLocalizedContentType = defineContentType({
  id: "test.delivered-localized",
  tableName: "test_delivered_localized",
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  publication: { enabled: true },
  editorial: { enabled: true },
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
    enabled: true,
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
    enabled: true,
    redirects: { enabled: true },
    hreflang: { xDefault: "defaultLocale" },
    seo: {
      titleField: "seo.title",
      fallbackTitleField: "title",
      descriptionField: "seo.description",
    },
    sitemap: { enabled: true, changeFrequency: "daily", priority: 0.5 },
  },
  admin: {
    list: { columns: ["status", "updatedAt"] },
  },
});

export const testDeliveredPreviewableContentType = defineContentType({
  id: "test.delivered-previewable",
  tableName: "test_delivered_previewable",
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  publication: { enabled: true },
  editorial: {
    enabled: true,
    preview: { enabled: true, expiresInMinutes: 30 },
  },
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
  },
  publicApi: {
    enabled: true,
    path: "delivered-previewable",
    fields: ["id", "title", "slug", "publishedAt"],
    defaultOrderBy: "publishedAt",
  },
  delivery: {
    enabled: true,
    redirects: { enabled: true },
    sitemap: { enabled: true },
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

export const testFilePostContentType = defineContentType({
  id: "test.file-post",
  tableName: "test_file_posts",
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    cover: field.file({
      maxBytes: 5 * 1024 * 1024,
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    }),
    animation: field.file({
      maxBytes: 10 * 1024 * 1024,
      allowedExtensions: [".gif"],
      allowedMimeTypes: ["image/gif"],
    }),
    document: field.file({
      maxBytes: 20 * 1024 * 1024,
      allowedExtensions: [".pdf"],
      allowedMimeTypes: ["application/pdf"],
    }),
  },
  publication: { enabled: true },
  publicApi: {
    enabled: true,
    path: "file-posts",
    fields: ["title", "slug", "cover", "publishedAt"],
  },
  admin: {
    titleField: "title",
    list: { columns: ["cover", "title", "status", "updatedAt"] },
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
  publication: { enabled: true },
  editorial: { enabled: true, revisions: { retention: 5 } },
  publicApi: {
    enabled: true,
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
