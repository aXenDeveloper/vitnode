import { createContentModel } from "@vitnode/core/content/server";

import { blogCategoryContentType } from "@/content/category";

export const categoryContent = createContentModel(blogCategoryContentType);

// Two exports for a localized content type, not one. Drizzle Kit discovers each
// table from the export when it globs the built `dist/src/database/*.js`, so the
// translation table needs its own or the migration would be generated without it.
export const blog_categories = categoryContent.table;
export const blog_categories_translations = categoryContent.translationTable;
