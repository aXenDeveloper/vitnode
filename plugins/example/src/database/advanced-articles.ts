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
      // `relatedArticles` is deliberately absent. It is a `self: true`
      // relation, and the engine resolves it from the table it is building:
      // writing `() => advancedArticleContent.table.id` here would reference
      // the model inside its own initializer, and TypeScript resolves that by
      // widening the whole model to `any` - silently taking every typed
      // service, schema and column map with it.
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
