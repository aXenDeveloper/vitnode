import { createContentModel } from "@vitnode/core/content/server";

import { commentContentType } from "@/content/comment";

import { newsroom_articles } from "./articles";

export const commentContent = createContentModel(commentContentType, {
  references: { article: () => newsroom_articles.id },
});

export const newsroom_comments = commentContent.table;
