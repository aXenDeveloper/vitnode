import { buildPlugin } from "@vitnode/core/lib/plugin";
import { ListIcon, NotebookPenIcon } from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";

export const blogPlugin = () => {
  return buildPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    admin: {
      nav: [
        {
          id: "posts",
          href: "/admin/blog/posts",
          icon: <NotebookPenIcon />,
        },
        {
          id: "categories",
          href: "/admin/blog/categories",
          icon: <ListIcon />,
        },
      ],
    },
  });
};
