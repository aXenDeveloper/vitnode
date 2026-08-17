import { contentTypeAdmin } from "@vitnode/core/lib/plugin";
import { buildPlugin } from "@vitnode/core/lib/plugin";
import { FolderIcon, NotebookPenIcon } from "lucide-react";

import { articleContentType } from "@/content/article";
import { categoryContentType } from "@/content/category";

import messages from "./locales";

/**
 * Registering the content types is the whole frontend integration: the AdminCP
 * screens, the nav items and the breadcrumbs are all generated from here.
 */
export const examplePlugin = () =>
  buildPlugin({
    pluginId: "@vitnode/example",
    messages,
    contentTypes: [
      contentTypeAdmin({
        definition: articleContentType,
        icon: <NotebookPenIcon />,
      }),
      contentTypeAdmin({
        definition: categoryContentType,
        icon: <FolderIcon />,
      }),
    ],
  });
