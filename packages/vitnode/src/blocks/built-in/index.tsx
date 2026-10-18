import { manifest } from "@/manifest";

import type { BlockPluginSource } from "../types";

import { ctaBlock } from "./cta";
import { heroBlock } from "./hero";
import { textBlock } from "./text";

export { ctaBlock } from "./cta";
export { heroBlock } from "./hero";
export { textBlock } from "./text";

/**
 * Core's built-in widgets - Call to action, Hero and Text - under the `core`
 * namespace (`core:hero`, ...). Core registers them itself.
 */
export const blocks = {
  pluginId: manifest.id,
  blocks: [ctaBlock, heroBlock, textBlock],
  namespace: "core",
} satisfies BlockPluginSource;

/** Alias of {@link blocks}. */
export const widgets = blocks;
