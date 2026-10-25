import { createContentModel } from "@vitnode/core/content/server";

import { articleContentType } from "@/content/article";

import { newsroom_categories } from "./categories";

export const articleContent = createContentModel(articleContentType, {
  references: { category: () => newsroom_categories.id },
});

export const newsroom_articles = articleContent.table;
