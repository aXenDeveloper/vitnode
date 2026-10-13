import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import {
  exampleArticleNav,
  exampleBoardsNav,
  exampleCategoryNav,
  exampleDiscussionNav,
  exampleEventNav,
  examplePageNav,
  exampleTagNav,
} from "./nav";

export const adminContent = {
  pluginId: CONFIG_PLUGIN.pluginId,
  containers: [exampleBoardsNav],
  contentTypes: [
    exampleArticleNav,
    exampleCategoryNav,
    examplePageNav,
    exampleTagNav,
    exampleEventNav,
    exampleDiscussionNav,
  ],
} satisfies ContentFrontendPluginSource;
