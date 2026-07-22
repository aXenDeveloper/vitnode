import { buildEventListener } from "@vitnode/core/api/lib/events";

declare module "@vitnode/core/api/models/events" {
  interface VitNodeEvents {
    "blog.category.created": {
      categoryId: number;
    };
    "blog.category.deleted": {
      categoryId: number;
      postIds: number[];
    };
    "blog.category.updated": {
      categoryId: number;
    };
    "blog.post.created": {
      categoryId: number;
      postId: number;
    };
    "blog.post.deleted": {
      categoryId: number;
      postId: number;
    };
    "blog.post.updated": {
      categoryId: number;
      postId: number;
    };
  }
}

export const cleanupCategorySearchListener = buildEventListener({
  event: "blog.category.deleted",
  name: "cleanup-category-search",
  description:
    "Remove search index rows of posts cascade-deleted with a category",
  handler: async (c, payload) => {
    for (const postId of payload.postIds) {
      await c.get("search").delete("blog_post", postId);
    }
  },
});
