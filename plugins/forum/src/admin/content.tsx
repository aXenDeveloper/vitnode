import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { manifest } from "@/manifest.gen";

import { forumForumsNav } from "./nav";

export const adminContent = {
  pluginId: manifest.id,
  containers: [forumForumsNav],
} satisfies ContentFrontendPluginSource;
