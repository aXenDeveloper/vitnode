import type { BlockPluginSource } from "../types";

import { CONFIG_PLUGIN } from "../../config";
import { ctaBlock } from "./cta";
import { heroBlock } from "./hero";
import { textBlock } from "./text";

export { ctaBlock } from "./cta";
export { heroBlock } from "./hero";
export { textBlock } from "./text";

export const blocks = {
  pluginId: CONFIG_PLUGIN.pluginId,
  blocks: [ctaBlock, heroBlock, textBlock],
  namespace: "core",
} satisfies BlockPluginSource;
