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
