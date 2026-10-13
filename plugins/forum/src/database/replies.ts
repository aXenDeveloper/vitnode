import { createContentModel } from "@vitnode/core/content/server";

import { replyContentType } from "@/content/reply";

import { forum_topics } from "./topics";

export const replyContent = createContentModel(replyContentType, {
  // `parent` is absent on purpose: a self-relation is resolved by the engine
  // from the table it is building.
  references: { topic: () => forum_topics.id },
});

export const forum_replies = replyContent.table;
