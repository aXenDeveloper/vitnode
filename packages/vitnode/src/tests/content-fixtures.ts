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
