import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import {
  exampleArticleNav,
  exampleCategoryNav,
  exampleEventNav,
  examplePageNav,
  exampleTagNav,
} from "./nav";

export const adminContent = {
  pluginId: CONFIG_PLUGIN.pluginId,
  contentTypes: [
    exampleArticleNav,
    exampleCategoryNav,
    examplePageNav,
    exampleTagNav,
    exampleEventNav,
  ],
} satisfies ContentFrontendPluginSource;
