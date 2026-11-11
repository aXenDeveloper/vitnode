import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { Context } from "hono";

import { buildEventListener } from "@vitnode/core/api/lib/events";
import { contentEvent } from "@vitnode/core/content";

import {
  blogCategoryCreatedEvent,
  blogCategoryDeletedEvent,
  blogCategoryUpdatedEvent,
  blogPostCreatedEvent,
  blogPostDeletedEvent,
  blogPostUpdatedEvent,
} from "@/api/event-definitions";
import { blogCategoryContentType } from "@/content/category";
import { blogPostContentType } from "@/content/post";
import { postContent } from "@/database/posts";

const categoryOf = async (
  c: Context<EnvVitNode>,
  postId: number,
): Promise<null | number> => {
  const [first] = await postContent.service(c).relations.categoryId.get(postId);

  return first ?? null;
};

export const legacyPostCreatedListener = buildEventListener({
  event: contentEvent(blogPostContentType, "created"),
  name: "legacy-blog-post-created",
  description: "Re-emits the blog's own blog.post.created event",
  handler: async (c, payload) => {
    const categoryId = await categoryOf(c, payload.contentId);
    if (categoryId === null) return;

    await c.get("events").emit(blogPostCreatedEvent, {
      categoryId,
      postId: payload.contentId,
    });
  },
});

export const legacyPostUpdatedListener = buildEventListener({
  event: contentEvent(blogPostContentType, "updated"),
  name: "legacy-blog-post-updated",
  description: "Re-emits the blog's own blog.post.updated event",
  handler: async (c, payload) => {
    const categoryId = await categoryOf(c, payload.contentId);
    if (categoryId === null) return;

    await c.get("events").emit(blogPostUpdatedEvent, {
      categoryId,
      postId: payload.contentId,
    });
  },
});

export const legacyPostDeletedListener = buildEventListener({
  event: contentEvent(blogPostContentType, "deleted"),
  name: "legacy-blog-post-deleted",
  description: "Re-emits the blog's own blog.post.deleted event",
  handler: async (c, payload) => {
    await c.get("events").emit(blogPostDeletedEvent, {
      postId: payload.contentId,
    });
  },
});

export const legacyCategoryCreatedListener = buildEventListener({
  event: contentEvent(blogCategoryContentType, "created"),
  name: "legacy-blog-category-created",
  description: "Re-emits the blog's own blog.category.created event",
  handler: async (c, payload) => {
    await c.get("events").emit(blogCategoryCreatedEvent, {
      categoryId: payload.contentId,
    });
  },
});

export const legacyCategoryUpdatedListener = buildEventListener({
  event: contentEvent(blogCategoryContentType, "updated"),
  name: "legacy-blog-category-updated",
  description: "Re-emits the blog's own blog.category.updated event",
  handler: async (c, payload) => {
    await c.get("events").emit(blogCategoryUpdatedEvent, {
      categoryId: payload.contentId,
    });
  },
});

export const legacyCategoryDeletedListener = buildEventListener({
  event: contentEvent(blogCategoryContentType, "deleted"),
  name: "legacy-blog-category-deleted",
  description: "Re-emits the blog's own blog.category.deleted event",
  handler: async (c, payload) => {
    await c.get("events").emit(blogCategoryDeletedEvent, {
      categoryId: payload.contentId,
      // See the payload's own note: a category with articles cannot be deleted,
      // so a deletion that happened had nothing to cascade.
      postIds: [],
    });
  },
});

/**
 * Listeners that re-emit the Content Engine's `content.blog.*` created, updated
 * and deleted events under the blog's older `blog.*` names, so existing
 * consumers keep working. Each runs as an ordinary listener of the `content.*`
 * event, through the installation's events adapter. Prefer the `content.*`
 * events for new code: they also cover publication, visibility, translations
 * and the other lifecycle actions, which have no `blog.*` name.
 *
 * Registered on the blog's top-level `admin` module, because event listeners
 * are only collected from top-level modules.
 */
export const blogLegacyEventListeners = [
  legacyCategoryCreatedListener,
  legacyCategoryDeletedListener,
  legacyCategoryUpdatedListener,
  legacyPostCreatedListener,
  legacyPostDeletedListener,
  legacyPostUpdatedListener,
];
