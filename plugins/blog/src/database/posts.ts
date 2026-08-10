import { createContentModel } from "@vitnode/core/content/server";

import { blogPostContentType } from "@/content/post";

import { blog_categories } from "./categories";

export const postContent = createContentModel(blogPostContentType, {
  // One thunk per `relation` field - a missing or extra key is a compile error,
  // and the thunk keeps circular content type references safe.
  references: { categoryId: () => blog_categories.id },
});

export const blog_posts = postContent.table;
export const blog_posts_translations = postContent.translationTable;
