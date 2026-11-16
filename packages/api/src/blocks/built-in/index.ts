import type { BlockPluginSource } from "../types";

import { manifest } from "../../manifest";
import { ctaBlockSchema } from "./cta";
import { heroBlockSchema } from "./hero";
import { textBlockSchema } from "./text";

export { ctaBlockSchema } from "./cta";
export { heroBlockSchema } from "./hero";
export { textBlockSchema } from "./text";

/**
 * Core's built-in widget schemas - Call to action, Hero and Text - under the
 * `core` namespace (`core:hero`, ...). The built-in API plugin registers them;
 * `@vitnode/core/widgets/built-in` adds their components under the same ids.
 */
export const blockSchemas = {
  pluginId: manifest.id,
  blocks: [ctaBlockSchema, heroBlockSchema, textBlockSchema],
  namespace: "core",
} satisfies BlockPluginSource;

/** Alias of {@link blockSchemas}. */
export const widgetSchemas = blockSchemas;
