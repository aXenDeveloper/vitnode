import { createContentModel } from "@vitnode/core/content/server";

import { bulletinContentType } from "@/content/bulletin";

export const bulletinContent = createContentModel(bulletinContentType);

// Two exports for a localized content type, not one. Drizzle Kit discovers each
// table from the export when it globs the built `dist/src/database/*.js`, so the
// translation table needs its own or the migration would be generated without it.
export const newsroom_bulletins = bulletinContent.table;
export const newsroom_bulletins_translations = bulletinContent.translationTable;
