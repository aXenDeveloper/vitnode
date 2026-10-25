import { createContentModel } from "@vitnode/core/content/server";

import { eventContentType } from "@/content/event";

import { newsroom_categories } from "./categories";
import { newsroom_tags } from "./tags";

export const eventContent = createContentModel(eventContentType, {
  references: {
    category: () => newsroom_categories.id,
    primaryTag: () => newsroom_tags.id,
    tags: () => newsroom_tags.id,
  },
});

export const newsroom_events = eventContent.table;
export const newsroom_events_translations = eventContent.translationTable;
export const newsroom_events_tags = eventContent.advancedTables.junctions.tags;
export const newsroom_events_related_events =
  eventContent.advancedTables.junctions.relatedEvents;
export const newsroom_events_gallery =
  eventContent.advancedTables.junctions.gallery;
export const newsroom_events_sessions =
  eventContent.advancedTables.repeatables.sessions;
