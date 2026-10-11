import { createContentModel } from "@vitnode/core/content/server";

import { tagContentType } from "@/content/tag";

import { example_categories } from "./categories";

export const tagContent = createContentModel(tagContentType, {
  references: { category: () => example_categories.id },
});

export const example_tags = tagContent.table;
export const example_tags_translations = tagContent.translationTable;
export const example_tags_related_tags =
  tagContent.advancedTables.junctions.relatedTags;
