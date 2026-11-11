import { defineEvent } from "@vitnode/core/api/lib/event-definition";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

/**
 * The blog's schema-defined events. Kept free of handlers and database code,
 * so another plugin can import a definition to listen to it.
 */

/** Compatibility name for `content.blog.post.deleted`. */
export const blogPostDeletedEvent = defineEvent({
  pluginId: manifest.id,
  name: "blog.post.deleted",
  payload: z.object({ postId: z.number().int() }),
});

/** Every definition the blog owns, for `buildApiPlugin({ eventDefinitions })`. */
export const blogEventDefinitions = [blogPostDeletedEvent];
