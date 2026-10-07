import { createContentModel } from "@vitnode/core/content/server";

import { tagContentType } from "@/content/tag";

import { example_categories } from "./categories";

export const tagContent = createContentModel(tagContentType, {
  // `relatedTags` is absent on purpose: a self-relation is resolved from the
  // table being built, and its junction's two columns are `uuid` like the key.
  references: { category: () => example_categories.id },
});

// Drizzle Kit discovers each table from its export when it globs the built
// `dist/src/database/*.js`.
export const example_tags = tagContent.table;
export const example_tags_translations = tagContent.translationTable;
export const example_tags_related_tags =
  tagContent.advancedTables.junctions.relatedTags;
