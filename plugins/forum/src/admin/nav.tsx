import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import { FolderTreeIcon } from "lucide-react";

import { forumContainers } from "@/content/forums";
import { manifest } from "@/manifest.gen";

export const forumForumsNav = {
  definition: forumContainers,
  icon: <FolderTreeIcon />,
};

export const adminNav = {
  pluginId: manifest.id,
  containers: [forumForumsNav],
} satisfies AdminNavPluginSource;
