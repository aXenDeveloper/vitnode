import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { manifest } from "@/manifest.gen";

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
  pluginId: manifest.id,
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
