import { buildPlugin } from "@vitnode/core/lib/plugin";
import { ListIcon, NotebookPenIcon } from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";

import messages from "./locales";

export const blogPlugin = () => {
  return buildPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    messages,
    admin: {
      nav: [
        {
          id: "posts",
          href: "/admin/blog/posts",
          icon: <NotebookPenIcon />,
          permission: { module: "posts", permission: "can_view" },
        },
        {
          id: "categories",
          href: "/admin/blog/categories",
          icon: <ListIcon />,
          permission: { module: "categories", permission: "can_view" },
        },
      ],
    },
  });
};
