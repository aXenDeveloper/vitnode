import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { ContentEventsFor } from "@vitnode/core/content";
import type { Context } from "hono";

import { buildEventListener } from "@vitnode/core/api/lib/events";
import { contentEventName } from "@vitnode/core/content";

import type { blogCategoryContentType } from "@/content/category";

import { blogPostContentType } from "@/content/post";
import { postContent } from "@/database/posts";

declare module "@vitnode/core/api/models/events" {
  interface VitNodeEvents
    extends
      ContentEventsFor<typeof blogCategoryContentType>,
      ContentEventsFor<typeof blogPostContentType> {
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
      postId: number;
    };
    "blog.post.updated": {
      categoryId: number;
      postId: number;
    };
  }
}

const POST = blogPostContentType.id;

// What is deliberately not bridged:
// - A duplicate is a create - `content.blog.post.created`, with
//   `duplicatedFromId` - so it re-emits `blog.post.created` exactly once, as a
//   new article should. `content.blog.post.duplicated` carries nothing a legacy
//   listener knows how to use, and re-emitting it would announce the article
//   twice.
// - Hiding and unhiding change who can read an article, not the article.
//   Neither is an update or a delete, and mapping them onto one would have a
//   legacy indexer drop or re-add a record the engine's own search sync
//   already handled. Listen to `content.blog.post.hidden` / `.unhidden`.
const CATEGORY = "blog.category";

const categoryOf = async (
  c: Context<EnvVitNode>,
  postId: number,
): Promise<null | number> => {
  const [first] = await postContent.service(c).relations.categoryId.get(postId);

  return first ?? null;
};

export const legacyPostCreatedListener = buildEventListener({
  event: contentEventName(POST, "created"),
  name: "legacy-blog-post-created",
  description: "Re-emits the blog's own blog.post.created event",
  handler: async (c, payload) => {
    const categoryId = await categoryOf(c, payload.contentId);
    if (categoryId === null) return;

    await c.get("events").emit("blog.post.created", {
      categoryId,
      postId: payload.contentId,
    });
  },
});

export const legacyPostUpdatedListener = buildEventListener({
  event: contentEventName(POST, "updated"),
  name: "legacy-blog-post-updated",
  description: "Re-emits the blog's own blog.post.updated event",
  handler: async (c, payload) => {
    const categoryId = await categoryOf(c, payload.contentId);
    if (categoryId === null) return;

    await c.get("events").emit("blog.post.updated", {
      categoryId,
      postId: payload.contentId,
    });
  },
});

export const legacyPostDeletedListener = buildEventListener({
  event: contentEventName(POST, "deleted"),
  name: "legacy-blog-post-deleted",
  description: "Re-emits the blog's own blog.post.deleted event",
  handler: async (c, payload) => {
    await c.get("events").emit("blog.post.deleted", {
      postId: payload.contentId,
    });
  },
});

export const legacyCategoryCreatedListener = buildEventListener({
  event: contentEventName(CATEGORY, "created"),
  name: "legacy-blog-category-created",
  description: "Re-emits the blog's own blog.category.created event",
  handler: async (c, payload) => {
    await c.get("events").emit("blog.category.created", {
      categoryId: payload.contentId,
    });
  },
});

export const legacyCategoryUpdatedListener = buildEventListener({
  event: contentEventName(CATEGORY, "updated"),
  name: "legacy-blog-category-updated",
  description: "Re-emits the blog's own blog.category.updated event",
  handler: async (c, payload) => {
    await c.get("events").emit("blog.category.updated", {
      categoryId: payload.contentId,
    });
  },
});

export const legacyCategoryDeletedListener = buildEventListener({
  event: contentEventName(CATEGORY, "deleted"),
  name: "legacy-blog-category-deleted",
  description: "Re-emits the blog's own blog.category.deleted event",
  handler: async (c, payload) => {
    await c.get("events").emit("blog.category.deleted", {
      categoryId: payload.contentId,
      // See the payload's own note: a category with articles cannot be deleted,
      // so a deletion that happened had nothing to cascade.
      postIds: [],
    });
  },
});

export const blogLegacyEventListeners = [
  legacyCategoryCreatedListener,
  legacyCategoryDeletedListener,
  legacyCategoryUpdatedListener,
  legacyPostCreatedListener,
  legacyPostDeletedListener,
  legacyPostUpdatedListener,
];
