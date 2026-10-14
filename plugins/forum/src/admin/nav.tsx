import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import { FolderTreeIcon } from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";
import { forumContainers } from "@/content/forums";

export const forumForumsNav = {
  definition: forumContainers,
  icon: <FolderTreeIcon />,
};

export const adminNav = {
  pluginId: CONFIG_PLUGIN.pluginId,
  containers: [forumForumsNav],
} satisfies AdminNavPluginSource;
