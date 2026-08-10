import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { ContentEventsFor } from "@vitnode/core/content";
import type { Context } from "hono";

import { buildEventListener } from "@vitnode/core/api/lib/events";
import { contentEventName } from "@vitnode/core/content";
import { eq } from "drizzle-orm";

import type { blogCategoryContentType } from "@/content/category";

import { blogPostContentType } from "@/content/post";
import { blog_posts } from "@/database/posts";

/**
 * The blog's own event names, kept as **adapters** over the Content Engine's.
 *
 * There is one mutation pipeline now - the engine's - and these listeners
 * translate its events into the names the blog has always published, so a plugin
 * listening for `blog.post.created` keeps working without the blog keeping a
 * second way to write a row.
 *
 * They are a compatibility layer with a shelf life. New listeners should use
 * `content.blog.post.*` and `content.blog.category.*`, which carry more: changed
 * fields, revision ids, publication transitions, per-locale translation events
 * and slug history - none of which the blog's own names ever had.
 */
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
      /**
       * Always empty.
       *
       * It always effectively was: the foreign key from `blog_posts` refuses a
       * category that still has articles, so a category deletion that succeeds
       * is one that had none. The field stays so existing listeners still
       * compile.
       */
      postIds: number[];
    };
    "blog.category.updated": {
      categoryId: number;
    };
    "blog.post.created": {
      categoryId: number;
      postId: number;
    };
    /**
     * No `categoryId`, unlike the other two.
     *
     * The row is gone by the time this is emitted, so there is nothing left to
     * read it from - and inventing one would put a wrong category id into an
     * audit trail. A listener that needs it should watch
     * `content.blog.post.deleted` and keep its own index.
     */
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
const CATEGORY = "blog.category";

/** The category an article is in, read back for the legacy payload. */
const categoryOf = async (
  c: Context<EnvVitNode>,
  postId: number,
): Promise<null | number> => {
  const [post] = await c
    .get("db")
    .select({ categoryId: blog_posts.categoryId })
    .from(blog_posts)
    .where(eq(blog_posts.id, postId))
    .limit(1);

  return post?.categoryId ?? null;
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
