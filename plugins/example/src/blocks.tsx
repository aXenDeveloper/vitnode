import type { BlockPluginSource } from "@vitnode/core/blocks";

import { CONFIG_PLUGIN } from "@/const";

import { calloutBlock } from "./blocks/callout";
import { featuresBlock } from "./blocks/features";

export { calloutBlock } from "./blocks/callout";
export { featuresBlock } from "./blocks/features";

export const blocks = {
  pluginId: CONFIG_PLUGIN.pluginId,
  blocks: [calloutBlock, featuresBlock],
} satisfies BlockPluginSource;
