import type { Plugin } from "vite";

import { configuredPluginIds } from "./plugin-routes";

const PACKAGE_NAME = "@vitnode/core";

const ALWAYS_EXTERNAL = ["tslib"] as const;

export const NITRO_TRACED_DEPENDENCIES = ["@simplewebauthn/server"] as const;

export interface VitNodeSsrExternalsOptions {
  /** The app's root directory, where `src/vitnode.config.ts` lives. */
  appRoot: string;
  /** Reads the configured plugin ids. Defaults to reading the app's config; replaceable in tests. */
  readPluginIds?: (appRoot: string) => Promise<string[]>;
}

/**
 * In a production build, keeps `@vitnode/core` and every configured plugin out
 * of the server bundle, loaded from `node_modules` at runtime instead.
 */
export const vitNodeSsrExternals = ({
  appRoot,
  readPluginIds = configuredPluginIds,
}: VitNodeSsrExternalsOptions): Plugin => ({
  config: async (_userConfig, { command }) => ({
    nitro:
      command === "build"
        ? {
            // Writes `.gz`/`.br` next to every static asset and prerendered
            // page at build time; Nitro's static handler serves the one the
            // browser accepts, so no CPU is spent compressing per request.
            // An app's own `nitro({ compressPublicAssets })` still wins.
            compressPublicAssets: { brotli: true, gzip: true },
            traceDeps: [...NITRO_TRACED_DEPENDENCIES],
          }
        : undefined,
    ssr: {
      external:
        command === "build"
          ? [
              PACKAGE_NAME,
              ...(await readPluginIds(appRoot)),
              ...ALWAYS_EXTERNAL,
            ]
          : [...ALWAYS_EXTERNAL],
    },
  }),
  name: "vitnode:ssr-externals",
});
