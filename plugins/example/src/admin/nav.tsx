import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import { FlaskConicalIcon, FolderIcon, NotebookPenIcon } from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";
import { articleContentType } from "@/content/article";
import { categoryContentType } from "@/content/category";

/**
 * Everything this plugin puts in the AdminCP sidebar, and nothing that renders a
 * screen.
 *
 * The **browser-safe** half of the frontend registration, split out so an
 * application can draw the sidebar without importing the other half.
 * `config.tsx` registers content types *with their editing screens* attached -
 * which for a plugin with field overrides means a form stack that still reaches
 * `next/dynamic` today - and a TanStack Start application cannot hold that graph
 * while the Content Engine is still Next's. A list of links does not need it: an
 * href is a string, a permission is three strings, a content type definition is
 * zod and plain data, and an icon is an element from an icon set.
 *
 * There is no second list. `config.tsx` spreads this straight into
 * `buildPlugin`, so the navigation a Next.js app renders and the navigation a
 * TanStack app renders are the same declarations read through two doors.
 *
 * The app that installs this plugin never imports it by name: the
 * `vitnode:plugin-routes` build step writes one literal import per configured
 * plugin that exports `admin/nav` into `src/admin-nav.gen.ts`.
 *
 * ## Navigation and routes are separate lists, on purpose
 *
 * `overview` below points at `/admin/example`, which this plugin also declares
 * as an admin-area route in `routes/manifest.ts` - but neither list is derived
 * from the other, and neither has to be complete for the other to work. The
 * content type entries here point into `/admin/content/*`, which the Content
 * Engine owns and no plugin route claims; and `guide-topic` over in the manifest
 * is a page reached from a link on another page, with no sidebar entry at all.
 */

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

export const adminNav = {
  pluginId: CONFIG_PLUGIN.pluginId,
  contentTypes: [exampleArticleNav, exampleCategoryNav],
  admin: {
    nav: [
      {
        /**
         * Titled from `@vitnode/example.admin.nav.overview`, which the shell
         * loads because the declaration says where the string is - see
         * `adminNavNamespaces`.
         *
         * No `permission`, and that is a decision rather than an omission. A
         * permission here is a `plugin`/`module`/`permission` triple that has to
         * exist in the staff tables, and this plugin's only modules are its two
         * content types - so gating an overview page on `article.can_view`
         * would invent a security relationship that is not real. The page is
         * offered to anybody the AdminCP has already let in, which is what the
         * shell's own session guard decides, and it exposes nothing an
         * administrator may not see.
         */
        href: "/admin/example",
        icon: <FlaskConicalIcon />,
        id: "overview",
      },
    ],
  },
} satisfies AdminNavPluginSource;
