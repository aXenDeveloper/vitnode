import type { WidgetPluginSource } from "@vitnode/api/blocks";

import { manifest } from "@/manifest.gen";

import { calloutSchema } from "./widgets/callout.schema";
import { featuresSchema } from "./widgets/features.schema";

/**
 * The newsroom widgets as the API registers them: schemas only, so the API
 * validates and stores their data without loading React. `./widgets` adds the
 * components under the same ids for the browser.
 */
export const widgetSchemas = {
  pluginId: manifest.id,
  blocks: [calloutSchema, featuresSchema],
} satisfies WidgetPluginSource;
