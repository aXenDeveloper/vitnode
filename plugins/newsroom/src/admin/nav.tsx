import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import {
  CalendarDaysIcon,
  FolderIcon,
  FolderTreeIcon,
  LayoutTemplateIcon,
  MailIcon,
  MessageSquareIcon,
  NewspaperIcon,
  NotebookPenIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react";

import { articleContentType } from "@/content/article";
import { categoryContentType } from "@/content/category";
import { commentContentType } from "@/content/comment";
import { deskContainers } from "@/content/desks";
import { eventContentType } from "@/content/event";
import { letterContentType } from "@/content/letter";
import { pageContentType } from "@/content/page";
import { storyContentType } from "@/content/story";
import { tagContentType } from "@/content/tag";
import { manifest } from "@/manifest.gen";

export const adminNav = {
  pluginId: manifest.id,
  containers: [{ definition: deskContainers, icon: <FolderTreeIcon /> }],
  contentTypes: [
    { definition: articleContentType, icon: <NewspaperIcon /> },
    { definition: categoryContentType, icon: <FolderIcon /> },
    { definition: commentContentType, icon: <MessageSquareIcon /> },
    { definition: storyContentType, icon: <NotebookPenIcon /> },
    { definition: tagContentType, icon: <TagIcon /> },
    { definition: eventContentType, icon: <CalendarDaysIcon /> },
    { definition: pageContentType, icon: <LayoutTemplateIcon /> },
    { definition: letterContentType, icon: <MailIcon /> },
  ],
  admin: {
    nav: [{ href: "/admin/newsroom", icon: <SparklesIcon />, id: "overview" }],
  },
} satisfies AdminNavPluginSource;
