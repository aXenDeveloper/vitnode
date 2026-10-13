import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import {
  CalendarDaysIcon,
  FlaskConicalIcon,
  FolderIcon,
  FolderTreeIcon,
  LayoutTemplateIcon,
  MessagesSquareIcon,
  NotebookPenIcon,
  TagIcon,
} from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";
import { articleContentType } from "@/content/article";
import { boardContainers } from "@/content/boards";
import { categoryContentType } from "@/content/category";
import { discussionContentType } from "@/content/discussion";
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

export const exampleTagNav = {
  definition: tagContentType,
  icon: <TagIcon />,
};

export const exampleEventNav = {
  definition: eventContentType,
  icon: <CalendarDaysIcon />,
};

export const exampleDiscussionNav = {
  definition: discussionContentType,
  icon: <MessagesSquareIcon />,
};

export const exampleBoardsNav = {
  definition: boardContainers,
  icon: <FolderTreeIcon />,
};

export const adminNav = {
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
