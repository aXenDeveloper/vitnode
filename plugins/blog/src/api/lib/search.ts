import type { SearchDocument, SearchIndexer } from "@vitnode/core/api/models/search";

import { asc } from "drizzle-orm";

import { blog_posts } from "@/database/posts";

interface BlogPostForSearch {
  authorId: null | number;
  categoryId: number;
  content: string;
  createdAt: Date;
  id: number;
  title: string;
  titleSeo: string;
  updatedAt?: Date;
}

export const buildBlogPostSearchDocument = (
  post: BlogPostForSearch,
): SearchDocument => ({
  itemType: "blog_post",
  itemId: post.id,
  authorId: post.authorId,
  title: post.title,
  content: post.content,
  containerType: "blog_category",
  containerId: post.categoryId,
  url: `/blog/${post.categoryId}/${post.titleSeo}`,
  isPublic: true,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
});

export const blogPostSearchIndexer: SearchIndexer = {
  itemType: "blog_post",
  load: async (c, offset, limit) => {
    const rows = await c
      .get("db")
      .select({
        id: blog_posts.id,
        title: blog_posts.title,
        titleSeo: blog_posts.titleSeo,
        content: blog_posts.content,
        categoryId: blog_posts.categoryId,
        authorId: blog_posts.authorId,
        createdAt: blog_posts.createdAt,
        updatedAt: blog_posts.updatedAt,
      })
      .from(blog_posts)
      .orderBy(asc(blog_posts.id))
      .limit(limit)
      .offset(offset);

    return rows.map(buildBlogPostSearchDocument);
  },
};
