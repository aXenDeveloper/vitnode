import type { Plugin } from "vite";

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { configuredPluginIds } from "./plugin-routes";

const PACKAGE_NAME = "@vitnode/core";

const BUILD_OUTPUT = ["dist", "src"] as const;

const SCANNED_FILES = "**/*.js";

const TAILWIND_IMPORT = /@import\s+["']tailwindcss["']/;

export interface VitNodeTailwindSourcesOptions {
  appRoot: string;

  readBuildOutput?: (appRoot: string, packageName: string) => null | string;

  readPluginIds?: (appRoot: string) => Promise<string[]>;
}

const buildOutputOf = (appRoot: string, packageName: string): null | string => {
  for (let directory = appRoot; ; directory = dirname(directory)) {
    const candidate = join(
      directory,
      "node_modules",
      packageName,
      ...BUILD_OUTPUT,
    );

    if (existsSync(candidate)) return candidate;
    if (dirname(directory) === directory) return null;
  }
};

const sourceDirective = (directory: string): string =>
  `@source "${directory.replaceAll("\\", "/")}/${SCANNED_FILES}";`;

export const vitNodeTailwindSources = ({
  appRoot,
  readBuildOutput = buildOutputOf,
  readPluginIds = configuredPluginIds,
}: VitNodeTailwindSourcesOptions): Plugin => {
  let directives = "";

  return {
    configResolved: async () => {
      const packageNames = [PACKAGE_NAME, ...(await readPluginIds(appRoot))];

      directives = packageNames
        .map(packageName => readBuildOutput(appRoot, packageName))
        .filter(directory => directory !== null)
        .map(sourceDirective)
        .join("\n");
    },
    enforce: "pre",
    name: "vitnode:tailwind-sources",
    transform: (code, id) => {
      if (directives === "") return null;
      if (!id.split("?")[0].endsWith(".css")) return null;
      if (!TAILWIND_IMPORT.test(code)) return null;

      return { code: `${code}\n${directives}\n`, map: null };
    },
  };
};
