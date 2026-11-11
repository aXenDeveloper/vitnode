import { defineEvent } from "@vitnode/core/api/lib/event-definition";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

/**
 * The blog's schema-defined events. Kept free of handlers and database code,
 * so another plugin can import a definition to listen to it. The Content
 * Engine's `content.blog.*` events come from `contentEvent()` instead.
 */

/** Compatibility name for `content.blog.category.created`. */
export const blogCategoryCreatedEvent = defineEvent({
  pluginId: manifest.id,
  name: "blog.category.created",
  payload: z.object({ categoryId: z.number().int() }),
});

/** Compatibility name for `content.blog.category.deleted`. */
export const blogCategoryDeletedEvent = defineEvent({
  pluginId: manifest.id,
  name: "blog.category.deleted",
  payload: z.object({
    categoryId: z.number().int(),
    /**
     * Always empty: a category that still has articles cannot be deleted
     * (`onDelete: "restrict"`), so a deletion never removes any.
     */
    postIds: z.array(z.number().int()),
  }),
});

/** Compatibility name for `content.blog.category.updated`. */
export const blogCategoryUpdatedEvent = defineEvent({
  pluginId: manifest.id,
  name: "blog.category.updated",
  payload: z.object({ categoryId: z.number().int() }),
});

/**
 * Compatibility name for `content.blog.post.created`. Skipped when no
 * category can be read back for the article.
 */
export const blogPostCreatedEvent = defineEvent({
  pluginId: manifest.id,
  name: "blog.post.created",
  payload: z.object({
    /** The article's first category only, although it can have several. */
    categoryId: z.number().int(),
    postId: z.number().int(),
  }),
});

/** Compatibility name for `content.blog.post.deleted`. */
export const blogPostDeletedEvent = defineEvent({
  pluginId: manifest.id,
  name: "blog.post.deleted",
  payload: z.object({ postId: z.number().int() }),
});

/**
 * Compatibility name for `content.blog.post.updated`. Skipped when no
 * category can be read back for the article.
 */
export const blogPostUpdatedEvent = defineEvent({
  pluginId: manifest.id,
  name: "blog.post.updated",
  payload: z.object({
    /** The article's first category only, although it can have several. */
    categoryId: z.number().int(),
    postId: z.number().int(),
  }),
});

/** Every definition the blog owns, for `buildApiPlugin({ eventDefinitions })`. */
export const blogEventDefinitions = [
  blogCategoryCreatedEvent,
  blogCategoryDeletedEvent,
  blogCategoryUpdatedEvent,
  blogPostCreatedEvent,
  blogPostDeletedEvent,
  blogPostUpdatedEvent,
];
