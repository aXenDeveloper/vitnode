import { createContentModel } from "@vitnode/core/content/server";

import { storyContentType } from "@/content/story";

import { newsroom_categories } from "./categories";

export const storyContent = createContentModel(storyContentType, {
  // One thunk per `relation` field - a missing or extra key is a compile error,
  // and the thunk keeps circular content type references safe.
  //
  // `gallery` is deliberately absent, exactly as a to-one `field.file` is: there
  // is one files table in an installation, so the engine resolves
  // `core_files.id` itself and asking a plugin to name it would be a line of
  // boilerplate with one correct value.
  references: { category: () => newsroom_categories.id },
  moderationScope: { column: "category", family: "newsroom.category" },
});

export const newsroom_stories = storyContent.table;
// Two exports, not one. Drizzle Kit discovers each table from its export when it
// globs the built `dist/src/database/*.js`, so the gallery's junction table
// without one would simply be missing from the migration.
export const newsroom_stories_gallery =
  storyContent.advancedTables.junctions.gallery;
