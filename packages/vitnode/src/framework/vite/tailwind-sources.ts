import type { Plugin } from "vite";

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { configuredPluginIds } from "./plugin-routes";

/**
 * Core's own output, and `@vitnode/api`'s: the API package ships class names
 * the renderers use too (a widget area's grid classes).
 */
const PACKAGE_NAMES = ["@vitnode/core", "@vitnode/api"] as const;

const BUILD_OUTPUT = ["dist", "src"] as const;

const SCANNED_FILES = "**/*.js";

const TAILWIND_IMPORT = /@import\s+["']tailwindcss["']/;

const RELATIVE_IMPORT = /@import\s+(?:url\()?["'](\.[^"']*)["']/g;

/** Options of {@link vitNodeTailwindSources}. Everything but `appRoot` is a test seam. */
export interface VitNodeTailwindSourcesOptions {
  /** The app's root directory, where `src/vitnode.config.ts` lives. */
  appRoot: string;

  readBuildOutput?: (appRoot: string, packageName: string) => null | string;

  readPluginIds?: (appRoot: string) => Promise<string[]>;

  readStylesheet?: (path: string) => null | string;
}

const buildOutputFrom = (start: string, packageName: string): null | string => {
  for (let directory = start; ; directory = dirname(directory)) {
    const candidate = join(
      directory,
      "node_modules",
      packageName,
      ...BUILD_OUTPUT,
    );

    if (existsSync(candidate)) return realpathSync(candidate);
    if (dirname(directory) === directory) return null;
  }
};

/**
 * A package's build output as the app sees it, else as core sees it - an app
 * that does not list `@vitnode/api` itself still reaches core's copy.
 */
const buildOutputOf = (appRoot: string, packageName: string): null | string =>
  buildOutputFrom(appRoot, packageName) ??
  buildOutputFrom(dirname(fileURLToPath(import.meta.url)), packageName);

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
  seen = new Set<string>(),
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

/**
 * Adds an `@source` for the built output of `@vitnode/core`, `@vitnode/api` and every
 * configured plugin to each stylesheet that imports Tailwind, so the classes
 * those packages use are generated without listing them by hand.
 */
export const vitNodeTailwindSources = ({
  appRoot,
  readBuildOutput = buildOutputOf,
  readPluginIds = configuredPluginIds,
  readStylesheet = stylesheetOf,
}: VitNodeTailwindSourcesOptions): Plugin => {
  let directives = "";

  return {
    configResolved: async () => {
      const packageNames = [
        ...PACKAGE_NAMES,
        ...(await readPluginIds(appRoot)),
      ];

      const directories = packageNames
        .map(packageName => readBuildOutput(appRoot, packageName))
        .filter(directory => directory !== null);

      directives = [...new Set(directories)].map(sourceDirective).join("\n");
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
