import { createContentModel } from "@vitnode/core/content/server";

import { blogPostContentType } from "@/content/post";

import { blog_categories } from "./categories";

/**
 * The server-side model of {@link blogPostContentType}: its Drizzle tables and
 * `postContent.service(c)` for reads and writes inside a request. Server-only -
 * import it from API code, never from a page.
 *
 * `categoryId` is bound to `blog_categories.id`, which is where the article's
 * `onDelete: "restrict"` foreign key points.
 */
export const postContent = createContentModel(blogPostContentType, {
  references: { categoryId: () => blog_categories.id },
});

// Every table is exported on its own: Drizzle Kit discovers tables from the
// exports of the built `dist/src/database/*.js` when generating migrations.
export const blog_posts = postContent.table;
export const blog_posts_translations = postContent.translationTable;

export const blog_posts_category_id =
  postContent.advancedTables.junctions.categoryId;
export const blog_posts_author_id =
  postContent.advancedTables.junctions.authorId;
