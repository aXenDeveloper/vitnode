import { buildPlugin } from "@vitnode/core/lib/plugin";

import { adminNav } from "./admin/nav";
import messages from "./locales";
import { routes } from "./routes/manifest";

/**
 * Registering the content types is the whole frontend integration: the AdminCP
 * screens, the nav items and the breadcrumbs are all generated from here.
 *
 * The navigation half is spread in from `./admin/nav` rather than written out
 * again, and that is the point of the split: that module is **browser-safe** -
 * ids, hrefs, permissions, icons and content type definitions, with nothing that
 * renders a screen - so an application that cannot hold this file's graph can
 * still draw this plugin's sidebar entries. There is one list, read through two
 * doors, so the two AdminCPs cannot drift.
 *
 * A plugin with field or form overrides keeps them here, on top of the same
 * declarations. This one has none, so the spread is the whole registration.
 */
export const examplePlugin = () =>
  buildPlugin({
    ...adminNav,
    messages,
    // Stage 5: the same list `routes/manifest.ts` hands the build tool, so a
    // route is declared once whichever path an app reads it through.
    routes,
  });
