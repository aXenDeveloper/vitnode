import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import { exampleArticleNav, exampleCategoryNav } from "./nav";

/**
 * This plugin's Content Engine registration.
 *
 * The **browser-safe** module an application's generated content registry
 * imports, and the half of the frontend integration that renders screens rather
 * than links. `config.tsx` spreads it, so there is one list and no second copy.
 *
 * This plugin overrides nothing, which is the point worth stating: the AdminCP
 * generates the list, the create screen, the edit screen and the delete
 * confirmation for both content types from their definitions alone. So the two
 * entries here are exactly the pairs `./nav` already declares - referenced
 * rather than retyped, which is why that module exports each one individually.
 * A plugin that later needs a custom editor field adds it *here*, on top of the
 * same pair, and nothing else in the plugin changes.
 *
 * The separation from `./nav` still earns its keep even with no overrides: an
 * application drawing a sidebar imports that module and never loads this one,
 * and this is the module that grows a Tiptap editor the day somebody adds one.
 */
export const adminContent = {
  pluginId: CONFIG_PLUGIN.pluginId,
  contentTypes: [exampleArticleNav, exampleCategoryNav],
} satisfies ContentFrontendPluginSource;
