import type { Plugin } from "vite";

import { configuredPluginIds } from "./plugin-routes";

const PACKAGE_NAME = "@vitnode/core";

const ALWAYS_EXTERNAL = ["tslib"] as const;

export interface VitNodeSsrExternalsOptions {
  appRoot: string;
  readPluginIds?: (appRoot: string) => Promise<string[]>;
}

export const vitNodeSsrExternals = ({
  appRoot,
  readPluginIds = configuredPluginIds,
}: VitNodeSsrExternalsOptions): Plugin => ({
  config: async (_userConfig, { command }) => ({
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
