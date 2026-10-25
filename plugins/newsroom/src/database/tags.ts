import { createContentModel } from "@vitnode/core/content/server";

import { tagContentType } from "@/content/tag";

import { newsroom_categories } from "./categories";

export const tagContent = createContentModel(tagContentType, {
  references: { category: () => newsroom_categories.id },
});

export const newsroom_tags = tagContent.table;
export const newsroom_tags_translations = tagContent.translationTable;
export const newsroom_tags_related_tags =
  tagContent.advancedTables.junctions.relatedTags;
