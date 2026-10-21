import type { NitroPluginConfig } from "nitro/vite";
import type { Plugin } from "vite";

import { nitro as nitroPlugin } from "nitro/vite";

import type { VitNodeEnvOptions } from "./env";
import type { VitNodePluginRoutesOptions } from "./plugin-routes";

import { vitNodeDevError } from "./dev-error";
import { vitNodeEnv } from "./env";
import { vitNodeOptimizeDeps } from "./optimize-deps";
import { vitNodePluginRoutes } from "./plugin-routes";
import { vitNodeSsrExternals } from "./ssr-externals";
import { vitNodeTailwindSources } from "./tailwind-sources";
import { vitNodeWebSocket } from "./websocket";

/** Options of the {@link vitnode} Vite plugin. */
export interface VitNodeViteOptions
  extends VitNodeEnvOptions, VitNodePluginRoutesOptions {
  /**
   * Options for Nitro, the server the app is built for and served by -
   * `prerender`, `preset`, `rollupConfig`, `routeRules`, `handlers` and the
   * rest of Nitro's config. VitNode adds its own on top: the SSR externals in a
   * build, the development error page in `vite dev` and, with `webSocket`, the
   * `/api/ws` route. Arrays are merged, so your `handlers` are kept alongside
   * VitNode's.
   */
  nitro?: NitroPluginConfig;
}

/**
 * VitNode's Vite plugins for a TanStack Start app, in one call: environment
 * variables, dependency pre-bundling, SSR externals, Tailwind sources for the
 * installed packages, the generated plugin registries, the development error
 * page, the WebSocket route and Nitro itself - do not add `nitro()` again.
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
 *   plugins: [
 *     vitnode({
 *       appRoot: import.meta.dirname,
 *       nitro: { rollupConfig: { external: [/^@sentry\//] } },
 *     }),
 *     tanstackStart(),
 *   ],
 * });
 * ```
 */
export const vitnode = ({
  appRoot,
  clientEnv,
  hostRoutesDir,
  nitro,
  webSocket,
}: VitNodeViteOptions): Plugin[] => [
  vitNodeEnv({ clientEnv, webSocket }),
  vitNodeOptimizeDeps(),
  vitNodeSsrExternals({ appRoot }),
  vitNodeTailwindSources({ appRoot }),
  vitNodePluginRoutes({ appRoot, hostRoutesDir }),
  vitNodeDevError(),
  vitNodeWebSocket({ webSocket }),
  ...nitroPlugin(nitro),
];
