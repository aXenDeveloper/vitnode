import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import { ListIcon, NotebookPenIcon } from "lucide-react";

import { blogCategoryContentType } from "@/content/category";
import { blogPostContentType } from "@/content/post";
import { manifest } from "@/manifest.gen";

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

/**
 * The blog's AdminCP sidebar entries, loaded from `@vitnode/blog/admin/nav`
 * into the app's generated `src/admin-nav.gen.ts`.
 */
export const adminNav = {
  pluginId: manifest.id,
  contentTypes: [blogPostNav, blogCategoryNav],
} satisfies AdminNavPluginSource;
