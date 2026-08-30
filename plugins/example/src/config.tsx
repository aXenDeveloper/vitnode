import { buildPlugin } from "@vitnode/core/lib/plugin";

import { adminContent } from "./admin/content";
import { adminNav } from "./admin/nav";
import messages from "./locales";
import { routes } from "./routes/manifest";

/**
 * Registering the content types is the whole frontend integration: the AdminCP
 * screens, the nav items and the breadcrumbs are all generated from here.
 *
 * Nothing about the AdminCP is written here. Both halves are spread in from
 * **browser-safe** modules, which is the point of the split - an application
 * that cannot hold this file's graph can still draw the sidebar and render the
 * content screens:
 *
 *     ./admin/nav      what exists    ids, hrefs, permissions, icons, definitions
 *     ./admin/content  how it edits   the above, plus field/column/form overrides
 *
 * One list per question, read through two doors, so the two AdminCPs cannot
 * drift. A plugin with field or form overrides declares them in `./admin/content`
 * on top of the same pairs; this one has none, so that module is the pairs
 * themselves.
 *
 * `contentTypes` is named explicitly rather than left to spread order:
 * `adminNav` carries the same key with the narrower, screen-less projection in
 * it, and which of two spreads wins is not something a reader should have to
 * work out.
 */
export const examplePlugin = () =>
  buildPlugin({
    ...adminNav,
    contentTypes: adminContent.contentTypes,
    messages,
    // Stage 5: the same list `routes/manifest.ts` hands the build tool, so a
    // route is declared once whichever path an app reads it through.
    routes,
  });
