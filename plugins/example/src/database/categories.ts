import { createContentModel } from "@vitnode/core/content/server";

import { categoryContentType } from "@/content/category";

export const categoryContent = createContentModel(categoryContentType);

// Drizzle Kit discovers the table from this export when it globs the built
// `dist/src/database/*.js`, so migrations stay generated and committed.
export const example_categories = categoryContent.table;
