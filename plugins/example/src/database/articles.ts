import { createContentModel } from "@vitnode/core/content/server";

import { articleContentType } from "@/content/article";

import { example_categories } from "./categories";

export const articleContent = createContentModel(articleContentType, {
  // One thunk per `relation` field - a missing or extra key is a compile error,
  // and the thunk keeps circular content type references safe.
  //
  // `gallery` is deliberately absent, exactly as a to-one `field.file` is: there
  // is one files table in an installation, so the engine resolves
  // `core_files.id` itself and asking a plugin to name it would be a line of
  // boilerplate with one correct value.
  references: { category: () => example_categories.id },
});

export const example_articles = articleContent.table;
// Two exports, not one. Drizzle Kit discovers each table from its export when it
// globs the built `dist/src/database/*.js`, so the gallery's junction table
// without one would simply be missing from the migration.
export const example_articles_gallery =
  articleContent.advancedTables.junctions.gallery;
