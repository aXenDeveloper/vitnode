import type { WidgetPluginSource } from "@vitnode/core/widgets";

import { CONFIG_PLUGIN } from "@/const";

import { calloutWidget } from "./widgets/callout";
import { featuresWidget } from "./widgets/features";

export { calloutWidget, calloutWidget as calloutBlock } from "./widgets/callout";
export { featuresWidget, featuresWidget as featuresBlock } from "./widgets/features";

export const widgets = {
  pluginId: CONFIG_PLUGIN.pluginId,
  blocks: [calloutWidget, featuresWidget],
} satisfies WidgetPluginSource;

export const blocks = widgets;
