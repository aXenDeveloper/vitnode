/* eslint-disable no-console */
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { getConfig } from "./get-config.js";
import {
  legacyRouteOverlaps,
  legacyRouteOverlapWarning,
} from "./legacy-route-overlap.js";
import {
  buildInitialRouteMap,
  copyDirectoryRecursive,
  findLocaleRoot,
  findPackagePath,
  findRepoRoot,
  isDirectoryEmpty,
  type SourceConfig,
} from "./shared/file-utils.js";

/**
 * Whether an app is a Next.js App Router app - the only kind that wants route
 * files copied into `src/app/`.
 *
 * `vitnode.config.ts` is no longer enough on its own: a TanStack Start app has
 * one too (`apps/web`), and copying Next.js pages into it fills `src/app/` with
 * `next/*` imports that nothing renders - a confusing directory at best, and a
 * failing Next-free boundary test at worst. That app mounts a plugin's pages
 * through its own route tree (`vitnode-plugin-routes.ts`) and needs nothing from
 * here.
 *
 * A Next config is the marker, because it is the one file only Next.js reads.
 */
const isNextApp = (appPath: string): boolean =>
  ["next.config.js", "next.config.mjs", "next.config.ts"].some(name =>
    existsSync(join(appPath, name)),
  );

export const preparePluginsFiles = async (flag?: string) => {
  // Detect which config file to load based on flag or auto-detection
  const cwd = process.cwd();
  const hasWebConfig = existsSync(join(cwd, "src", "vitnode.config.ts"));
  const hasApiConfig = existsSync(join(cwd, "src", "vitnode.api.config.ts"));

  let config: {
    plugins: {
      pluginId: string;
      routes?: { entry?: unknown; id?: unknown }[];
    }[];
  };

  if (flag === "--api" && hasApiConfig) {
    // Force API config when --api flag is used
    config = await getConfig({ type: "api.config" });
  } else if (flag === "--web" && hasWebConfig) {
    // Force web config when --web flag is used
    config = await getConfig({});
  } else if (hasApiConfig && !hasWebConfig) {
    // API config only (auto-detect)
    config = await getConfig({ type: "api.config" });
  } else if (hasWebConfig) {
    // Web config (may also have API config but web takes precedence in auto-detect)
    config = await getConfig({});
  } else {
    // No config found, use empty plugins array
    config = { plugins: [] };
  }

  // Migration-only, and it warns rather than throws. A plugin whose route
  // manifest points at `src/routes/{main,admin,blank,breadcrumb}/…` has its
  // module copied into every Next.js app as well as bundled from its own dist,
  // which is confusing rather than broken. Deleted with this whole file at the
  // cutover; see `legacy-route-overlap.ts`.
  const overlapWarning = legacyRouteOverlapWarning(
    legacyRouteOverlaps(config.plugins),
  );

  if (overlapWarning) console.warn(`\x1b[33m${overlapWarning}\x1b[0m`);

  const plugins: string[] = [
    ...config.plugins.map(plugin => plugin.pluginId),
    "@vitnode/core",
  ];

  const repoRoot = findRepoRoot(process.cwd());
  const localeRoot = findLocaleRoot(repoRoot);
  const routeMap = buildInitialRouteMap(localeRoot);

  // For both monorepo apps and standalone projects: use current directory as base
  const baseDir = process.cwd();

  await Promise.all(
    plugins.map(async pluginName => {
      const pluginPath = findPackagePath(pluginName, repoRoot);

      if (!pluginPath) {
        console.error(
          `\x1b[31mPlugin not found:\x1b[0m ${pluginName} in node_modules`,
        );

        return;
      }

      // Get the package name from package.json for imports
      let packageName = "";
      try {
        const packageJsonPath = join(pluginPath, "package.json");
        if (existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(
            await readFile(packageJsonPath, "utf-8"),
          );
          packageName = packageJson.name ?? "";
        }
      } catch (error) {
        console.error(
          `\x1b[31mError reading package.json for ${pluginName}:\x1b[0m`,
          error,
        );

        return;
      }

      // Transform plugin name for path usage
      const pluginPathName = pluginName.replace(/\//g, "-").replace(/@/g, "");

      // Detect app types by checking for config files
      const detectAppType = (appPath: string) => {
        const hasWebConfig = existsSync(
          join(appPath, "src", "vitnode.config.ts"),
        );
        const hasApiConfig = existsSync(
          join(appPath, "src", "vitnode.api.config.ts"),
        );

        if (hasApiConfig && !hasWebConfig) return "api";
        if (hasWebConfig && isNextApp(appPath)) return "web";

        return null;
      };

      // Check if we're in a monorepo by looking for apps directories
      const appsDir = join(repoRoot, "apps");
      const isMonorepo = existsSync(appsDir);

      // Define source configurations for this plugin
      const sources: SourceConfig[] = [];

      if (isMonorepo) {
        // Monorepo: scan all apps and detect their types
        const appDirs = existsSync(appsDir)
          ? readdirSync(appsDir, { withFileTypes: true })
              .filter(dirent => dirent.isDirectory())
              .map(dirent => dirent.name)
          : [];

        for (const appName of appDirs) {
          const appPath = join(repoRoot, "apps", appName);
          const appType = detectAppType(appPath);

          if (appType === "web") {
            // Web app: copy routes (main + admin). Locales are read from
            // `node_modules` at request time, never copied.
            const mainDest = join(
              appPath,
              "src",
              "app",
              "[locale]",
              "(main)",
              join("(plugins)", `(${pluginPathName})`),
            );
            const adminDest = join(
              appPath,
              "src",
              "app",
              "[locale]",
              "admin",
              "(auth)",
              join("(plugins)", `(${pluginPathName})`),
            );
            sources.push(
              {
                sourceDir: join(pluginPath, "src", "routes", "admin"),
                destinationDir: adminDest,
              },
              {
                sourceDir: join(pluginPath, "src", "routes", "main"),
                destinationDir: mainDest,
              },
              // Blank routes: pages without the main/admin layout (only the
              // root `[locale]` layout applies).
              {
                sourceDir: join(pluginPath, "src", "routes", "blank"),
                destinationDir: join(
                  appPath,
                  "src",
                  "app",
                  "[locale]",
                  "(blank)",
                  join("(plugins)", `(${pluginPathName})`),
                ),
              },
              // Breadcrumb parallel-route slots ship as framework routes and copy
              // into the SHARED `@breadcrumb` slot (NOT namespaced under
              // `(plugins)/(<plugin>)` like other routes): core and every plugin
              // write their breadcrumb pages side by side into the same dir. Route
              // sync must never mirror-cleanup this dir (see `cleanupDeletedFiles`)
              // or one contributor's copy wipes another's.
              {
                sourceDir: join(
                  pluginPath,
                  "src",
                  "routes",
                  "breadcrumb",
                  "admin",
                ),
                destinationDir: join(
                  appPath,
                  "src",
                  "app",
                  "[locale]",
                  "admin",
                  "(auth)",
                  "@breadcrumb",
                ),
              },
              {
                sourceDir: join(
                  pluginPath,
                  "src",
                  "routes",
                  "breadcrumb",
                  "main",
                ),
                destinationDir: join(
                  appPath,
                  "src",
                  "app",
                  "[locale]",
                  "(main)",
                  "@breadcrumb",
                ),
              },
            );
          }
        }
      } else {
        // Standalone project: use current directory as base
        const mainDest = join(
          baseDir,
          "src",
          "app",
          "[locale]",
          "(main)",
          join("(plugins)", `(${pluginPathName})`),
        );
        const adminDest = join(
          baseDir,
          "src",
          "app",
          "[locale]",
          "admin",
          "(auth)",
          join("(plugins)", `(${pluginPathName})`),
        );
        sources.push(
          {
            sourceDir: join(pluginPath, "src", "routes", "admin"),
            destinationDir: adminDest,
          },
          {
            sourceDir: join(pluginPath, "src", "routes", "main"),
            destinationDir: mainDest,
          },
          {
            sourceDir: join(pluginPath, "src", "routes", "blank"),
            destinationDir: join(
              baseDir,
              "src",
              "app",
              "[locale]",
              "(blank)",
              join("(plugins)", `(${pluginPathName})`),
            ),
          },
          {
            sourceDir: join(pluginPath, "src", "routes", "breadcrumb", "admin"),
            destinationDir: join(
              baseDir,
              "src",
              "app",
              "[locale]",
              "admin",
              "(auth)",
              "@breadcrumb",
            ),
          },
          {
            sourceDir: join(pluginPath, "src", "routes", "breadcrumb", "main"),
            destinationDir: join(
              baseDir,
              "src",
              "app",
              "[locale]",
              "(main)",
              "@breadcrumb",
            ),
          },
        );
      }

      // Copy files for each source directory
      for (const { sourceDir, destinationDir } of sources) {
        if (existsSync(sourceDir) && !isDirectoryEmpty(sourceDir)) {
          console.log(
            `\x1b[36mCopying ${pluginName}:\x1b[0m ${relative(repoRoot, sourceDir)} → ${relative(repoRoot, destinationDir)}`,
          );
          copyDirectoryRecursive(
            sourceDir,
            destinationDir,
            packageName,
            routeMap,
            localeRoot,
            repoRoot,
            false, // verbose = false for prepare mode
          );
        }
      }
    }),
  );
};
