import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import {
  FolderTreeIcon,
  MessageSquareReplyIcon,
  MessagesSquareIcon,
} from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";
import { forumContainers } from "@/content/forums";
import { replyContentType } from "@/content/reply";
import { topicContentType } from "@/content/topic";

export const forumForumsNav = {
  definition: forumContainers,
  icon: <FolderTreeIcon />,
};

export const forumTopicNav = {
  definition: topicContentType,
  icon: <MessagesSquareIcon />,
};

export const forumReplyNav = {
  definition: replyContentType,
  icon: <MessageSquareReplyIcon />,
};

export const adminNav = {
  pluginId: CONFIG_PLUGIN.pluginId,
  containers: [forumForumsNav],
  contentTypes: [forumTopicNav, forumReplyNav],
} satisfies AdminNavPluginSource;
