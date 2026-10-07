import { createContentModel } from "@vitnode/core/content/server";

import { eventContentType } from "@/content/event";

import { example_categories } from "./categories";
import { example_tags } from "./tags";

export const eventContent = createContentModel(eventContentType, {
  // Each foreign key takes the type of the key it points at - `uuid` for the
  // tags, `integer` for the category - and a reference whose column disagrees
  // with the target's `idStrategy` is refused by name when it resolves.
  references: {
    category: () => example_categories.id,
    primaryTag: () => example_tags.id,
    tags: () => example_tags.id,
  },
});

export const example_events = eventContent.table;
export const example_events_translations = eventContent.translationTable;
export const example_events_tags = eventContent.advancedTables.junctions.tags;
export const example_events_related_events =
  eventContent.advancedTables.junctions.relatedEvents;
export const example_events_gallery =
  eventContent.advancedTables.junctions.gallery;
export const example_events_sessions =
  eventContent.advancedTables.repeatables.sessions;
