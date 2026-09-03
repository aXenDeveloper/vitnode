import type { Plugin } from "vite";

import type { VitNodeEnvOptions } from "./env";
import type { VitNodePluginRoutesOptions } from "./plugin-routes";

import { vitNodeEnv } from "./env";
import { vitNodeOptimizeDeps } from "./optimize-deps";
import { vitNodePluginRoutes } from "./plugin-routes";

export interface VitNodeViteOptions
  extends VitNodeEnvOptions, VitNodePluginRoutesOptions {}

/**
 * Everything a VitNode app needs from Vite, as one plugin.
 *
 *     plugins: [
 *       vitnode({ appRoot: import.meta.dirname }),
 *       nitro(),
 *       tailwindcss(),
 *       tanstackStart(),
 *       viteReact(),
 *     ]
 *
 * A Vite plugin may be an array, so this is the composition and not a wrapper:
 * the three plugins underneath are returned in the order they have to run, and
 * each is still exported on its own for an app that genuinely wants to drop or
 * reorder one.
 *
 * `appRoot` is the only required option, and it has to be `import.meta.dirname`:
 * a Vite config is loaded with the working directory set to wherever the command
 * ran, which in a monorepo is regularly the repository root. Every path the route
 * generator reads hangs off it.
 */
export const vitnode = ({
  appRoot,
  clientEnv,
  hostRoutesDir,
}: VitNodeViteOptions): Plugin[] => [
  vitNodeEnv({ clientEnv }),
  vitNodeOptimizeDeps(),
  vitNodePluginRoutes({ appRoot, hostRoutesDir }),
];
