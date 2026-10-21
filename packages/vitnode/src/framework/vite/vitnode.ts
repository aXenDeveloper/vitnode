import type { Plugin } from "vite";

import type { VitNodeEnvOptions } from "./env";
import type { VitNodePluginRoutesOptions } from "./plugin-routes";

import { vitNodeDevError } from "./dev-error";
import { vitNodeEnv } from "./env";
import { vitNodeOptimizeDeps } from "./optimize-deps";
import { vitNodePluginRoutes } from "./plugin-routes";
import { vitNodeSsrExternals } from "./ssr-externals";
import { vitNodeTailwindSources } from "./tailwind-sources";

/** Options of the {@link vitnode} Vite plugin. */
export interface VitNodeViteOptions
  extends VitNodeEnvOptions, VitNodePluginRoutesOptions {}

/**
 * VitNode's Vite plugins for a TanStack Start app, in one call: environment
 * variables, dependency pre-bundling, SSR externals, Tailwind sources for the
 * installed packages, the generated plugin registries, and the development
 * error page.
 *
 * Add it before `tanstackStart()` in `vite.config.ts`.
 *
 * @example
 * ```ts
 * import { tanstackStart } from "@tanstack/react-start/plugin/vite";
 * import { vitnode } from "@vitnode/core/framework/vite";
 * import { defineConfig } from "vite";
 *
 * export default defineConfig({
 *   plugins: [vitnode({ appRoot: import.meta.dirname }), tanstackStart()],
 * });
 * ```
 */
export const vitnode = ({
  appRoot,
  clientEnv,
  hostRoutesDir,
  webSocket,
}: VitNodeViteOptions): Plugin[] => [
  vitNodeEnv({ clientEnv, webSocket }),
  vitNodeOptimizeDeps(),
  vitNodeSsrExternals({ appRoot }),
  vitNodeTailwindSources({ appRoot }),
  vitNodePluginRoutes({ appRoot, hostRoutesDir }),
  vitNodeDevError(),
];
