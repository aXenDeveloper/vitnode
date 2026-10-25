import { createContentModel } from "@vitnode/core/content/server";

import { explainerContentType } from "@/content/explainer";

import { newsroom_categories } from "./categories";
import { newsroom_tags } from "./tags";

export const explainerContent = createContentModel(explainerContentType, {
  references: {
    // A to-many relation needs a reference thunk exactly as a to-one does:
    // its foreign key is `related_item_id` on the generated junction table
    // rather than a column on the row, but the target is just as much a fact
    // this module has to supply.
    categories: () => newsroom_categories.id,
    tags: () => newsroom_tags.id,
    // `relatedExplainers` is deliberately absent. It is a `self: true`
    // relation, and the engine resolves it from the table it is building:
    // writing `() => explainerContent.table.id` here would reference
    // the model inside its own initializer, and TypeScript resolves that by
    // widening the whole model to `any` - silently taking every typed
    // service, schema and column map with it.
  },
});

// Six exports, not one. Drizzle Kit discovers each table from its export when
// it globs the built `dist/src/database/*.js`, so a junction or child table
// without one would simply be missing from the migration.
export const newsroom_explainers = explainerContent.table;
export const newsroom_explainers_translations =
  explainerContent.translationTable;
export const newsroom_explainers_categories =
  explainerContent.advancedTables.junctions.categories;
export const newsroom_explainers_tags =
  explainerContent.advancedTables.junctions.tags;
export const newsroom_explainers_related_explainers =
  explainerContent.advancedTables.junctions.relatedExplainers;
export const newsroom_explainers_faq =
  explainerContent.advancedTables.repeatables.faq;
