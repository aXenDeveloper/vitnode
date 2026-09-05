import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import { exampleArticleNav, exampleCategoryNav } from "./nav";

export const adminContent = {
  pluginId: CONFIG_PLUGIN.pluginId,
  contentTypes: [exampleArticleNav, exampleCategoryNav],
} satisfies ContentFrontendPluginSource;
