import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import { ListIcon, NotebookPenIcon } from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";
import { blogCategoryContentType } from "@/content/category";
import { blogPostContentType } from "@/content/post";

/**
 * Everything this plugin puts in the AdminCP sidebar, and nothing that renders a
 * screen.
 *
 * The **browser-safe** half of `config.tsx`. That file registers the same two
 * content types with their editing screens attached - the Tiptap field, the form
 * layout, the colour cell - which reach core's form stack and, today,
 * `next/dynamic`; an application that is not Next.js cannot hold that graph
 * while the Content Engine is still Next's. Drawing two links does not need it:
 * a content type definition is zod and plain data, and an icon is an element
 * from an icon set.
 *
 * There is no second list. `config.tsx` builds its registrations *from these
 * two*, adding only the overrides - so the definition and the icon are written
 * once and the two AdminCPs cannot show different sidebars.
 *
 * Exported individually as well as together because that is what makes the
 * single-source claim hold: `contentTypeAdmin` infers a content type's field
 * names from the `definition` it is handed, and it can only do that from a value
 * whose type has not been widened by an array.
 *
 * The blog declares no `admin.nav` of its own - its whole AdminCP presence is
 * the two generated Content Engine screens - so the hrefs here point into
 * `/admin/content/*`, which Stage 13 migrates. Until it does, the host's link
 * component sends them to the Next.js application; the sidebar names them either
 * way, because navigation describes what exists rather than what a given router
 * happens to render.
 */

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

export const adminNav = {
  pluginId: CONFIG_PLUGIN.pluginId,
  contentTypes: [blogPostNav, blogCategoryNav],
} satisfies AdminNavPluginSource;
