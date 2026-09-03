import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import { FlaskConicalIcon, FolderIcon, NotebookPenIcon } from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";
import { articleContentType } from "@/content/article";
import { categoryContentType } from "@/content/category";

/** The article content type, as the sidebar reads it. */
export const exampleArticleNav = {
  definition: articleContentType,
  icon: <NotebookPenIcon />,
};

/** The category content type, likewise. */
export const exampleCategoryNav = {
  definition: categoryContentType,
  icon: <FolderIcon />,
};

export const adminNav = {
  pluginId: CONFIG_PLUGIN.pluginId,
  contentTypes: [exampleArticleNav, exampleCategoryNav],
  admin: {
    nav: [
      {
        href: "/admin/example",
        icon: <FlaskConicalIcon />,
        id: "overview",
      },
    ],
  },
} satisfies AdminNavPluginSource;
