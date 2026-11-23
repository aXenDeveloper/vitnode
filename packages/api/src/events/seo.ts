import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

/**
 * The SEO settings were saved in the AdminCP. Fires after the write has
 * committed.
 */
export const seoSettingsUpdatedEvent = defineEvent({
  pluginId: manifest.id,
  name: "seo.settings.updated",
  payload: z.object({
    allowIndexing: z.boolean(),
    blockAiCrawlers: z.boolean(),
    sitemapEnabled: z.boolean(),
    /** Source ids switched off after this save. */
    disabledSitemapSources: z.array(z.string()),
    changedById: z.number().int(),
  }),
});

/** Every `seo.*` event core defines. */
export const seoEventDefinitions = [seoSettingsUpdatedEvent];
