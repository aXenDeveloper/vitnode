import { buildPlugin } from "@vitnode/core/lib/plugin";

import { adminContent } from "./admin/content";
import { adminNav } from "./admin/nav";
import messages from "./locales";
import { routes } from "./routes";

export const examplePlugin = () =>
  buildPlugin({
    ...adminNav,
    contentTypes: adminContent.contentTypes,
    messages,
    // The same tree `routes.ts` hands the build tool, so a route is declared
    // once whichever path an app reads it through.
    routes,
  });
