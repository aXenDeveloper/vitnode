import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import { forumForumsNav } from "./nav";

export const adminContent = {
  pluginId: CONFIG_PLUGIN.pluginId,
  containers: [forumForumsNav],
} satisfies ContentFrontendPluginSource;
