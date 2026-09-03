import "@tanstack/react-start/server-only";
import { buildServerConfig } from "@vitnode/core/vitnode.config";

import { appMessages } from "#/locales/app";
import { packageMessages } from "#/locales/packages";
import { vitNodeConfig } from "#/vitnode.config";

/**
 * The half of this app's configuration a browser may never hold.
 *
 * Both entries are `() => import(...)` loaders that read JSON out of a package's
 * build output, which is exactly what `vitnode.config.ts` cannot carry - so they
 * live here, beside the shared config rather than duplicating any of it. The
 * `server-only` marker makes an accidental import from a component a build error
 * instead of a browser bundle with every plugin's AdminCP copy in it.
 *
 * `src/server/messages.server.ts` is the only reader.
 */
export const vitNodeServerConfig = buildServerConfig({
  config: vitNodeConfig,
  messages: appMessages,
  packageMessages,
});
