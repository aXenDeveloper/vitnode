import type { BlockPluginSource } from "@vitnode/core/blocks";

import { CONFIG_PLUGIN } from "@/const";

import { calloutBlock } from "./blocks/callout";

export { calloutBlock } from "./blocks/callout";

export const blocks = {
  pluginId: CONFIG_PLUGIN.pluginId,
  blocks: [calloutBlock],
} satisfies BlockPluginSource;
