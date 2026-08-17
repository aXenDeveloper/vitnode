import { createContentModel } from "@vitnode/core/content/server";

import { localizedArticleContentType } from "@/content/localized-article";

export const localizedArticleContent = createContentModel(
  localizedArticleContentType,
);

// Two exports for a localized content type, not one. Drizzle Kit discovers each
// table from the export when it globs the built `dist/src/database/*.js`, so the
// translation table needs its own or the migration would be generated without it.
export const example_localized_articles = localizedArticleContent.table;
export const example_localized_articles_translations =
  localizedArticleContent.translationTable;
