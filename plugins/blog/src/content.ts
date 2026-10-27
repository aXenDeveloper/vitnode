import { blogCategoryContentType } from "@/content/category";
import { blogCommentContentType } from "@/content/comment";
import { blogPostContentType } from "@/content/post";

/**
 * The blog's content type definitions, read from `@vitnode/blog/content` by the
 * VitNode Vite plugin to check that a page serves every public URL they declare
 * (only the article has one: its `search.pathTemplate`, `/blog/article/{slug}`).
 * Browser-safe: it imports only the definitions, never the database models.
 */
export const contentTypes = [
  blogPostContentType,
  blogCategoryContentType,
  blogCommentContentType,
];
