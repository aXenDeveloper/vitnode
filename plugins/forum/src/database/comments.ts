import { createContentModel } from "@vitnode/core/content/server";

import { commentContentType } from "@/content/comment";

import { forum_topics } from "./topics";

export const commentContent = createContentModel(commentContentType, {
  // `parent` is absent on purpose: a self-relation is resolved by the engine
  // from the table it is building.
  references: { topic: () => forum_topics.id },
});

export const forum_comments = commentContent.table;
