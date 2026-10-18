import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { ContentEventsFor } from "@vitnode/core/content";
import type { Context } from "hono";

import { buildEventListener } from "@vitnode/core/api/lib/events";
import { contentEventName } from "@vitnode/core/content";

import type { blogCategoryContentType } from "@/content/category";

import { blogPostContentType } from "@/content/post";
import { postContent } from "@/database/posts";

// Types every `content.blog.post.*` / `content.blog.category.*` event the
// Content Engine emits, plus the six older `blog.*` names re-emitted below.
declare module "@vitnode/core/api/models/events" {
  interface VitNodeEvents
    extends
      ContentEventsFor<typeof blogCategoryContentType>,
      ContentEventsFor<typeof blogPostContentType> {
    /** Compatibility name for `content.blog.category.created`. */
    "blog.category.created": {
      categoryId: number;
    };
    /** Compatibility name for `content.blog.category.deleted`. */
    "blog.category.deleted": {
      categoryId: number;
      /**
       * Always empty: a category that still has articles cannot be deleted
       * (`onDelete: "restrict"`), so a deletion never removes any.
       */
      postIds: number[];
    };
    /** Compatibility name for `content.blog.category.updated`. */
    "blog.category.updated": {
      categoryId: number;
    };
    /**
     * Compatibility name for `content.blog.post.created`. Skipped when no
     * category can be read back for the article.
     */
    "blog.post.created": {
      /** The article's first category only, although it can have several. */
      categoryId: number;
      postId: number;
    };
    /** Compatibility name for `content.blog.post.deleted`. */
    "blog.post.deleted": {
      postId: number;
    };
    /**
     * Compatibility name for `content.blog.post.updated`. Skipped when no
     * category can be read back for the article.
     */
    "blog.post.updated": {
      /** The article's first category only, although it can have several. */
      categoryId: number;
      postId: number;
    };
  }
}

const POST = blogPostContentType.id;
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
