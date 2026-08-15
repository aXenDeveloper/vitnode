import { createContentModel } from "@vitnode/core/content/server";

import { blogPostContentType } from "@/content/post";

import { blog_categories } from "./categories";

export const postContent = createContentModel(blogPostContentType, {
  references: { categoryId: () => blog_categories.id },
});

export const blog_posts = postContent.table;
export const blog_posts_translations = postContent.translationTable;

export const blog_posts_category_id =
  postContent.advancedTables.junctions.categoryId;
export const blog_posts_author_id =
  postContent.advancedTables.junctions.authorId;
