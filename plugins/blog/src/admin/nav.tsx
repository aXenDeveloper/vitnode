import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import { ListIcon, NotebookPenIcon } from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";
import { blogCategoryContentType } from "@/content/category";
import { blogPostContentType } from "@/content/post";

/**
 * Everything this plugin puts in the AdminCP sidebar, and nothing that renders a
 * screen.
 *
 * The narrowest of the plugin's three frontend modules, and the split is about
 * *weight* rather than about what a framework can hold: `./content` registers
 * the same two content types with their editing screens attached - the Tiptap
 * field, the form layout, the colour cell - and an application that only wants
 * a sidebar has no business fetching an editor for it. A content type
 * definition is zod and plain data, and an icon is an element from an icon set.
 *
 * There is no second list. `./content` builds its registrations *from these
 * two*, adding only the overrides, and `config.tsx` spreads that - so the
 * definition and the icon are written once and the two AdminCPs cannot show
 * different sidebars.
 *
 * Exported individually as well as together because that is what makes the
 * single-source claim hold: `contentTypeAdmin` infers a content type's field
 * names from the `definition` it is handed, and it can only do that from a value
 * whose type has not been widened by an array.
 *
 * The blog declares no `admin.nav` of its own - its whole AdminCP presence is
 * the two generated Content Engine screens - so the hrefs here point into
 * `/admin/content/*`. They said exactly that before Stage 13 moved that
 * namespace into the TanStack router and they say it still: the host's link
 * component decides per href which application serves one, and navigation
 * describes what exists rather than what a given router happens to render.
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
