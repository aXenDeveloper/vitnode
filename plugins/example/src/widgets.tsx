import type { WidgetPluginSource } from "@vitnode/core/widgets";

import { CONFIG_PLUGIN } from "@/const";

import { calloutWidget } from "./widgets/callout";
import { featuresWidget } from "./widgets/features";

export {
  calloutWidget as calloutBlock,
  calloutWidget,
} from "./widgets/callout";
export {
  featuresWidget as featuresBlock,
  featuresWidget,
} from "./widgets/features";

export const widgets = {
  pluginId: CONFIG_PLUGIN.pluginId,
  blocks: [calloutWidget, featuresWidget],
} satisfies WidgetPluginSource;

export const blocks = widgets;
