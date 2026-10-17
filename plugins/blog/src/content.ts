import { blogCategoryContentType } from "@/content/category";
import { blogPostContentType } from "@/content/post";

/**
 * Every blog content type with a public URL, read from `@vitnode/blog/content`
 * by the VitNode Vite plugin to check that a page serves each public URL a
 * definition declares (the article's `search.pathTemplate`, `/blog/{slug}`).
 * Browser-safe: it imports only the definitions, never the database models.
 */
export const contentTypes = [blogPostContentType, blogCategoryContentType];
