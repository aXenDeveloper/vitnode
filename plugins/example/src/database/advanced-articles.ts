import { createContentModel } from "@vitnode/core/content/server";

import { advancedArticleContentType } from "@/content/advanced-article";

import { example_categories } from "./categories";

export const advancedArticleContent = createContentModel(
  advancedArticleContentType,
  {
    references: {
      // A to-many relation needs a reference thunk exactly as a to-one does:
      // its foreign key is `related_item_id` on the generated junction table
      // rather than a column on the row, but the target is just as much a fact
      // this module has to supply.
      categories: () => example_categories.id,
      // The self-relation points at this content type's own table, which is
      // being declared right here. The thunk is what makes that legal: Drizzle
      // leaves it unevaluated until it serializes the table, so there is no
      // circular initialization to trip over.
      relatedArticles: () => advancedArticleContent.table.id,
    },
  },
);

// Five exports, not one. Drizzle Kit discovers each table from its export when
// it globs the built `dist/src/database/*.js`, so a junction or child table
// without one would simply be missing from the migration.
export const example_advanced_articles = advancedArticleContent.table;
export const example_advanced_articles_translations =
  advancedArticleContent.translationTable;
export const example_advanced_articles_categories =
  advancedArticleContent.advancedTables.junctions.categories;
export const example_advanced_articles_related_articles =
  advancedArticleContent.advancedTables.junctions.relatedArticles;
export const example_advanced_articles_faq =
  advancedArticleContent.advancedTables.repeatables.faq;
