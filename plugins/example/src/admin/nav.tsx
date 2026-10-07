import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import {
  CalendarDaysIcon,
  FlaskConicalIcon,
  FolderIcon,
  LayoutTemplateIcon,
  NotebookPenIcon,
  TagIcon,
} from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";
import { articleContentType } from "@/content/article";
import { categoryContentType } from "@/content/category";
import { eventContentType } from "@/content/event";
import { pageContentType } from "@/content/page";
import { tagContentType } from "@/content/tag";

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

export const examplePageNav = {
  definition: pageContentType,
  icon: <LayoutTemplateIcon />,
};

/** Tags are keyed by `uuid`: their edit URLs carry a lowercase uuid. */
export const exampleTagNav = {
  definition: tagContentType,
  icon: <TagIcon />,
};

/** Events are keyed by `bigint`: their ids stay exact decimal strings. */
export const exampleEventNav = {
  definition: eventContentType,
  icon: <CalendarDaysIcon />,
};

export const adminNav = {
  pluginId: CONFIG_PLUGIN.pluginId,
  contentTypes: [
    exampleArticleNav,
    exampleCategoryNav,
    examplePageNav,
    exampleTagNav,
    exampleEventNav,
  ],
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
