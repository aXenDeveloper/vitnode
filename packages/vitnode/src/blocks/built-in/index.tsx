import { manifest } from "@/manifest";

import type { BlockPluginSource } from "../types";

import { ctaBlock } from "./cta";
import { heroBlock } from "./hero";
import { textBlock } from "./text";

export { ctaBlock } from "./cta";
export { heroBlock } from "./hero";
export { textBlock } from "./text";

export const blocks = {
  pluginId: manifest.id,
  blocks: [ctaBlock, heroBlock, textBlock],
  namespace: "core",
} satisfies BlockPluginSource;

export const widgets = blocks;
