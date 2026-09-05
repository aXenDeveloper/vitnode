import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import { ListIcon, NotebookPenIcon } from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";
import { blogCategoryContentType } from "@/content/category";
import { blogPostContentType } from "@/content/post";

/** The post content type, as the sidebar reads it. */
export const blogPostNav = {
  definition: blogPostContentType,
  icon: <NotebookPenIcon />,
};

/** The category content type, likewise. */
export const blogCategoryNav = {
  definition: blogCategoryContentType,
  icon: <ListIcon />,
};

export const adminNav = {
  pluginId: CONFIG_PLUGIN.pluginId,
  contentTypes: [blogPostNav, blogCategoryNav],
} satisfies AdminNavPluginSource;
