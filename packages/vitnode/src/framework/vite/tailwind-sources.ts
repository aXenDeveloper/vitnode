import type { Plugin } from "vite";

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { configuredPluginIds } from "./plugin-routes";

const PACKAGE_NAME = "@vitnode/core";

const BUILD_OUTPUT = ["dist", "src"] as const;

const SCANNED_FILES = "**/*.js";

const TAILWIND_IMPORT = /@import\s+["']tailwindcss["']/;

const RELATIVE_IMPORT = /@import\s+(?:url\()?["'](\.[^"']*)["']/g;

export interface VitNodeTailwindSourcesOptions {
  appRoot: string;

  readBuildOutput?: (appRoot: string, packageName: string) => null | string;

  readPluginIds?: (appRoot: string) => Promise<string[]>;

  readStylesheet?: (path: string) => null | string;
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

const stylesheetOf = (path: string): null | string => {
  for (const candidate of [path, `${path}.css`]) {
    try {
      return readFileSync(candidate, "utf8");
    } catch {
      continue;
    }
  }

  return null;
};

const buildsTailwind = (
  code: string,
  id: string,
  readStylesheet: (path: string) => null | string,
  seen: Set<string> = new Set(),
): boolean => {
  if (TAILWIND_IMPORT.test(code)) return true;

  return [...code.matchAll(RELATIVE_IMPORT)].some(([, specifier]) => {
    const path = resolve(dirname(id), specifier);

    if (seen.has(path)) return false;
    seen.add(path);

    const imported = readStylesheet(path);

    return (
      imported !== null && buildsTailwind(imported, path, readStylesheet, seen)
    );
  });
};

const sourceDirective = (directory: string): string =>
  `@source "${directory.replaceAll("\\", "/")}/${SCANNED_FILES}";`;

export const vitNodeTailwindSources = ({
  appRoot,
  readBuildOutput = buildOutputOf,
  readPluginIds = configuredPluginIds,
  readStylesheet = stylesheetOf,
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

      const path = id.split("?")[0];

      if (!path.endsWith(".css")) return null;
      if (!buildsTailwind(code, path, readStylesheet)) return null;

      return { code: `${code}\n${directives}\n`, map: null };
    },
  };
};
