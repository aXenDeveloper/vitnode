import { contentTypeAdmin } from "@vitnode/core/lib/plugin";
import { buildPlugin } from "@vitnode/core/lib/plugin";
import { FolderIcon, NotebookPenIcon } from "lucide-react";

import { articleContentType } from "@/content/article";
import { categoryContentType } from "@/content/category";

import messages from "./locales";
import { routes } from "./routes/manifest";

/**
 * Registering the content types is the whole frontend integration: the AdminCP
 * screens, the nav items and the breadcrumbs are all generated from here.
 */
export const examplePlugin = () =>
  buildPlugin({
    pluginId: "@vitnode/example",
    messages,
    // Stage 5: the same list `routes/manifest.ts` hands the build tool, so a
    // route is declared once whichever path an app reads it through.
    routes,
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
