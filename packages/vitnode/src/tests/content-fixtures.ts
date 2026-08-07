import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";

/**
 * Shared content types for Content Engine tests. Kept under `src/tests` so
 * Vitest does not pick them up as a suite, and deliberately close to the
 * `plugins/example` reference definitions.
 */
export const testCategoryContentType = defineContentType({
  id: "test.category",
  tableName: "test_categories",
  fields: {
    title: field.text({ required: true, minLength: 1, maxLength: 100 }),
  },
  admin: {
    label: { plural: "Test Categories", singular: "Test Category" },
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
    label: { plural: "Test Articles", singular: "Test Article" },
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
    label: { plural: "Test Posts", singular: "Test Post" },
    titleField: "title",
    list: {
      searchableFields: ["title", "excerpt"],
      orderableFields: ["title"],
      defaultOrderBy: "publishedAt",
    },
  },
});

/**
 * The Stage 4 shape: `testPostContentType` plus the full editorial workflow.
 *
 * A separate fixture rather than a flag on the post, for the same reason the
 * searchable one is separate: leaving the post exactly as it was is what proves
 * a Stage 2 content type is untouched by editorial existing.
 */
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
    label: { plural: "Test Editorials", singular: "Test Editorial" },
    titleField: "title",
    list: {
      columns: ["status", "title", "version"],
      defaultOrderBy: "version",
    },
  },
});

/**
 * Editorial without publication or a public API - the "revisions stand alone"
 * fixture. Neither preview nor scheduling is expressible here, which is the
 * point.
 */
export const testEditorialNoteContentType = defineContentType({
  id: "test.note",
  tableName: "test_notes",
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    body: field.textarea({ nullable: true }),
  },
  editorial: { enabled: true },
  admin: { label: { plural: "Test Notes", singular: "Test Note" } },
});

/**
 * The Stage 3 shape: `testPostContentType` plus `search`.
 *
 * A separate fixture rather than a flag on the post: keeping the post exactly as
 * it was is what proves a Stage 2 content type is untouched by search existing.
 * `code` and `author` stay out of `publicApi.fields` so "an indexed field is a
 * public field" has something to be wrong about.
 */
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
    label: { plural: "Test Searchables", singular: "Test Searchable" },
    titleField: "title",
    list: { defaultOrderBy: "publishedAt" },
  },
});

/**
 * The Stage 5A shape: shared and localized fields on one content type.
 *
 * A separate fixture rather than a flag on an existing one, for the same reason
 * the searchable and editorial ones are separate: leaving every Stage 1-4 fixture
 * exactly as it was is what proves localization existing changes nothing for
 * them.
 */
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
    label: { plural: "Test Localized", singular: "Test Localized" },
    list: { columns: ["featured", "views"], orderableFields: ["views"] },
  },
});

/**
 * Localized with a slug the caller always supplies.
 *
 * The other half of the slug rules: a sourceless localized slug is `required` in
 * the translation create payload, where a sourced one is derived.
 */
export const testLocalizedNoteContentType = defineContentType({
  id: "test.localized-note",
  tableName: "test_localized_notes",
  localization: { enabled: true, defaultLocale: "EN" },
  fields: {
    heading: field.text({ localized: true, required: true }),
    slug: field.slug({ localized: true }),
    pinned: field.boolean({ defaultValue: false }),
  },
  admin: {
    label: { plural: "Test Localized Notes", singular: "Test Localized Note" },
  },
});

/**
 * The Stage 5B fixture: localized **and** editorial **and** published.
 *
 * All three, because that is the combination the editorial layer needs and the
 * one Stage 5A refused. The translation table gains `status` and `publishedAt`,
 * each locale gets its own version and its own history, and the base row keeps the
 * global lifecycle every translation's visibility is subordinate to.
 *
 * `publicApi` and `search` are still absent - the first because
 * `testLocalizedPageContentType` covers the public read layer, and the second
 * because it remains refused alongside localization until Stage 5D.
 */
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
    label: {
      plural: "Test Localized Guides",
      singular: "Test Localized Guide",
    },
    list: { columns: ["featured", "status"] },
  },
});

/**
 * The Stage 5C fixture: localized **and** public.
 *
 * Everything the localized guide has, plus `publicApi` - so it exercises the
 * things only a public localized content type can have: a locale-aware read, a
 * strict-locale slug, a fallback, a per-locale cache tag and a preview link bound
 * to one language.
 *
 * The allowlist deliberately mixes the two halves of the partition. `title`,
 * `slug` and `body` come off the translation and `featured` off the base row, so
 * a public response is a join rather than a projection - and `searchableFields`
 * and `filterableFields` each name one of each, which is what proves both are
 * evaluated against the translation actually being served.
 */
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
    label: { plural: "Test Localized Pages", singular: "Test Localized Page" },
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
    label: {
      plural: "Test Strict Localized Pages",
      singular: "Test Strict Localized Page",
    },
    list: { columns: ["featured", "status"] },
  },
});
