/* eslint-disable no-console */
import chokidar from "chokidar";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { basename, join, relative } from "node:path";

import {
  buildInitialRouteMap,
  cleanupDeletedFiles,
  copyFile,
  findLocaleRoot,
  findRepoRoot,
  isDirectoryEmpty,
  routeKey,
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

/**
 * Helper: detect if an app path is web, api, or null
 */
const detectAppType = (appPath: string) => {
  const hasWebConfig = existsSync(join(appPath, "src", "vitnode.config.ts"));
  const hasApiConfig = existsSync(
    join(appPath, "src", "vitnode.api.config.ts"),
  );

  if (hasApiConfig && !hasWebConfig) return "api";
  if (hasWebConfig && isNextApp(appPath)) return "web";

  return null;
};

/**
 * Helper: collect source/destination mappings for a plugin
 *
 * Only web apps need anything copied - Next.js has to see route files inside
 * `app/`. API apps get nothing: they read a plugin's routes and locales
 * straight out of `node_modules`.
 */
const collectSources = (
  pluginDir: string,
  repoRoot: string,
  pluginName: string,
  pluginPathName: string,
): SourceConfig[] => {
  const sources: SourceConfig[] = [];
  const appsDir = join(repoRoot, "apps");
  const isMonorepo = existsSync(appsDir);

  if (isMonorepo) {
    const appDirs = existsSync(appsDir)
      ? readdirSync(appsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name)
      : [];

    for (const appName of appDirs) {
      const appPath = join(repoRoot, "apps", appName);
      const appType = detectAppType(appPath);

      if (appType === "web") {
        sources.push(
          {
            sourceDir: join(pluginDir, "src", "routes", "admin"),
            destinationDir: join(
              appPath,
              "src",
              "app",
              "[locale]",
              "admin",
              "(auth)",
              join("(plugins)", `(${pluginPathName})`),
            ),
          },
          {
            sourceDir: join(pluginDir, "src", "routes", "main"),
            destinationDir: join(
              appPath,
              "src",
              "app",
              "[locale]",
              "(main)",
              join("(plugins)", `(${pluginPathName})`),
            ),
          },
          {
            sourceDir: join(pluginDir, "src", "routes", "blank"),
            destinationDir: join(
              appPath,
              "src",
              "app",
              "[locale]",
              "(blank)",
              join("(plugins)", `(${pluginPathName})`),
            ),
          },
          {
            sourceDir: join(pluginDir, "src", "routes", "breadcrumb", "admin"),
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
            sourceDir: join(pluginDir, "src", "routes", "breadcrumb", "main"),
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
    const cwd = process.cwd();
    const projectType = detectAppType(cwd);

    if (projectType === "web") {
      sources.push(
        {
          sourceDir: join(pluginDir, "src", "routes", "admin"),
          destinationDir: join(
            cwd,
            "src",
            "app",
            "[locale]",
            "admin",
            "(auth)",
            join("(plugins)", `(${pluginPathName})`),
          ),
        },
        {
          sourceDir: join(pluginDir, "src", "routes", "main"),
          destinationDir: join(
            cwd,
            "src",
            "app",
            "[locale]",
            "(main)",
            join("(plugins)", `(${pluginPathName})`),
          ),
        },
        {
          sourceDir: join(pluginDir, "src", "routes", "blank"),
          destinationDir: join(
            cwd,
            "src",
            "app",
            "[locale]",
            "(blank)",
            join("(plugins)", `(${pluginPathName})`),
          ),
        },
        {
          sourceDir: join(pluginDir, "src", "routes", "breadcrumb", "admin"),
          destinationDir: join(
            cwd,
            "src",
            "app",
            "[locale]",
            "admin",
            "(auth)",
            "@breadcrumb",
          ),
        },
        {
          sourceDir: join(pluginDir, "src", "routes", "breadcrumb", "main"),
          destinationDir: join(
            cwd,
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

  return sources;
};

/**
 * Ensure destination directories exist for non-empty source dirs
 */
const ensureDestinationDirs = (sources: SourceConfig[]) => {
  for (const { sourceDir, destinationDir } of sources) {
    if (
      existsSync(sourceDir) &&
      !isDirectoryEmpty(sourceDir) &&
      !existsSync(destinationDir)
    ) {
      mkdirSync(destinationDir, { recursive: true });
    }
  }
};

/**
 * Create wrappers for copy and remove operations that close over routeMap/localeRoot/repoRoot
 */
const createFileOps = (
  pluginName: string,
  routeMap: Map<string, string>,
  localeRoot: string,
  repoRoot: string,
) => {
  const copyFileWrapper = (srcPath: string, destPath: string) => {
    copyFile(srcPath, destPath, pluginName, routeMap, localeRoot, repoRoot);
  };

  const removeFile = (filePath: string) => {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`\x1b[33mRemoved:\x1b[0m ${filePath}`);

        if (/^page\.(tsx|ts|jsx|js)$/i.test(basename(filePath))) {
          const key = routeKey(filePath, localeRoot);
          if (routeMap.get(key) === filePath) {
            routeMap.delete(key);
          }
        }
      }
    } catch (error) {
      console.error(`\x1b[31mError removing file:\x1b[0m ${filePath}`, error);
    }
  };

  return { copyFileWrapper, removeFile };
};

/**
 * Resolve destination paths for a given source path across all source configs
 */
const makeGetDestinationPaths = (sources: SourceConfig[]) => {
  return (srcPath: string): string[] => {
    const candidates = sources.filter(({ sourceDir }) => {
      const normalizedSrcPath = srcPath.replace(/\\/g, "/");
      const normalizedSourceDir = sourceDir.replace(/\\/g, "/");

      return (
        normalizedSrcPath === normalizedSourceDir ||
        normalizedSrcPath.startsWith(`${normalizedSourceDir}/`)
      );
    });

    if (candidates.length === 0) {
      throw new Error(`No matching source directory for: ${srcPath}`);
    }

    return candidates.map(sourceConfig => {
      const relativePath = relative(sourceConfig.sourceDir, srcPath);

      return join(sourceConfig.destinationDir, relativePath);
    });
  };
};

/**
 * Setup chokidar watcher with handlers
 */
const setupWatcher = (
  sourceDirs: string[],
  getDestinationPaths: (p: string) => string[],
  copyFileWrapper: (s: string, d: string) => void,
  removeFile: (p: string) => void,
) => {
  const watcher = chokidar.watch(sourceDirs, {
    ignoreInitial: false,
    persistent: true,
  });

  watcher
    .on("add", filePath => {
      const destPaths = getDestinationPaths(filePath);
      destPaths.forEach(destPath => copyFileWrapper(filePath, destPath));
    })
    .on("change", filePath => {
      const destPaths = getDestinationPaths(filePath);
      destPaths.forEach(destPath => copyFileWrapper(filePath, destPath));
    })
    .on("unlink", filePath => {
      const destPaths = getDestinationPaths(filePath);
      destPaths.forEach(destPath => removeFile(destPath));
    })
    .on("error", error => {
      console.error("\x1b[31mWatcher error:\x1b[0m", error);
    });

  return watcher;
};

/**
 * Main exported function (kept small and delegating to helpers)
 */
export const processPlugin = ({ initMessage }: { initMessage: string }) => {
  const pluginDir = process.cwd();
  const repoRoot = findRepoRoot(pluginDir);
  const localeRoot = findLocaleRoot(repoRoot);
  const routeMap = buildInitialRouteMap(localeRoot);

  let pluginName = basename(pluginDir);
  try {
    const packageJsonPath = join(pluginDir, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      pluginName = packageJson.name ?? "";
    }
  } catch (error) {
    console.error("\x1b[31mError reading package.json:\x1b[0m", error);

    return;
  }

  const pluginPathName = pluginName.replace(/\//g, "-").replace(/@/g, "");

  const sources = collectSources(
    pluginDir,
    repoRoot,
    pluginName,
    pluginPathName,
  );

  if (sources.length === 0) {
    console.log(
      `${initMessage} \x1b[34mNothing to sync - no web app in this project.\x1b[0m`,
    );

    return;
  }

  ensureDestinationDirs(sources);

  const { copyFileWrapper, removeFile } = createFileOps(
    pluginName,
    routeMap,
    localeRoot,
    repoRoot,
  );

  // Cleanup deleted files that might have been removed while this script wasn't running
  for (const { sourceDir, destinationDir } of sources) {
    cleanupDeletedFiles(sourceDir, destinationDir, removeFile);
  }

  console.log(
    `${initMessage} \x1b[34mWatching for changes in plugins...\x1b[0m`,
  );

  const sourceDirs = sources
    .map(s => s.sourceDir)
    .filter(dir => existsSync(dir));

  const getDestinationPaths = makeGetDestinationPaths(sources);

  setupWatcher(sourceDirs, getDestinationPaths, copyFileWrapper, removeFile);
};
