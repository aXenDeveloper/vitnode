import { createContentModel } from "@vitnode/core/content/server";

import { articleContentType } from "@/content/article";

import { example_categories } from "./categories";

export const articleContent = createContentModel(articleContentType, {
  // One thunk per `relation` field - a missing or extra key is a compile error,
  // and the thunk keeps circular content type references safe.
  references: { category: () => example_categories.id },
});

export const example_articles = articleContent.table;
