import type { Plugin } from "vite";

import { createJiti } from "jiti";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  dirname,
  join,
  relative,
  resolve as resolvePath,
  sep,
} from "node:path";
import { pathToFileURL } from "node:url";

import type { ResolvedAdminNavModule } from "../admin-nav";
import type { ResolvedContentRegistryModule } from "../content-registry";
import type {
  CompiledPluginRoutes,
  HostRoutePath,
  PluginRouteCompilerSource,
} from "../plugin-routes";

import { generateAdminNavSource } from "../admin-nav";
import { generateContentRegistrySource } from "../content-registry";
import {
  compilePluginRoutes,
  hostRoutePathsFromFiles,
  lazyImportSpecifier,
  pluginIdsFromLoadedConfig,
  routeDeclarationsFromRoutesModule,
} from "../plugin-routes";
import { createGenerationQueue } from "./generation-queue";
import { versionedModuleUrl } from "./module-version";

const ROUTES_SUBPATH = "routes";

const LEGACY_MANIFEST_SUBPATH = "routes/manifest";

const ADMIN_NAV_SUBPATH = "admin/nav";

const ADMIN_CONTENT_SUBPATH = "admin/content";

const ERROR_PREFIX = "[VitNode plugin routes]";

/** Where a file-based router keeps an app's own route files, by convention. */
const DEFAULT_HOST_ROUTES_DIR = join("src", "routes");

export interface VitNodePluginRoutesOptions {
  appRoot: string;

  hostRoutesDir?: null | string;
}

/** Everything the plugin reads and writes, derived from the app root. */
const pathsFor = (appRoot: string) => ({
  /** The configured plugin list, and the only place it is read from. */
  config: join(appRoot, "src", "vitnode.config.ts"),

  adminNav: join(appRoot, "src", "admin-nav.gen.ts"),

  contentRegistry: join(appRoot, "src", "content-registry.gen.ts"),

  registry: join(appRoot, "src", "plugin-routes.gen.ts"),

  staleManifest: join(appRoot, "src", "plugin-route-manifest.gen.ts"),
  /** The file-based router's config, read only for where the routes are. */
  routerConfig: join(appRoot, "tsr.config.json"),
});

const resolverFor = (appRoot: string) => {
  const requireFromApp = createRequire(join(appRoot, "package.json"));

  return (specifier: string): null | string => {
    try {
      const file = requireFromApp.resolve(specifier);

      return existsSync(file) ? file : null;
    } catch {
      return null;
    }
  };
};

const readConfiguredPluginIds = async (
  appRoot: string,
  configPath: string,
): Promise<string[]> => {
  const jiti = createJiti(pathToFileURL(join(appRoot, "package.json")).href, {
    interopDefault: true,
    moduleCache: false,
  });

  return pluginIdsFromLoadedConfig(
    await jiti.import(configPath),
    relative(appRoot, configPath),
  );
};

export const configuredPluginIds = async (appRoot: string): Promise<string[]> =>
  await readConfiguredPluginIds(appRoot, pathsFor(appRoot).config);

const readPluginRoutes = async (
  pluginId: string,
  resolvePackageFile: (specifier: string) => null | string,
): Promise<{ source: PluginRouteCompilerSource; watch: null | string }> => {
  const specifier = `${pluginId}/${ROUTES_SUBPATH}`;
  const file = resolvePackageFile(specifier);

  if (file === null) {
    assertNoLegacyRouteManifest(pluginId, resolvePackageFile);

    return { source: { pluginId }, watch: null };
  }

  const loaded: unknown = await import(
    versionedModuleUrl(file, statSync(file))
  );

  return {
    source: {
      pluginId,
      routes: routeDeclarationsFromRoutesModule(loaded, specifier),
      routesSpecifier: specifier,
    },
    watch: file,
  };
};

/**
 * Fails the build for a plugin that still declares the flat route manifest.
 *
 * Only reached when the plugin exports no `routes` module, which is exactly the
 * shape a plugin written against the previous API has: `routes/manifest`
 * resolves and `routes` does not. Without this it is indistinguishable from a
 * plugin that ships no pages, so every one of its URLs would 404 with nothing
 * anywhere saying why.
 */
const assertNoLegacyRouteManifest = (
  pluginId: string,
  resolvePackageFile: (specifier: string) => null | string,
): void => {
  const legacy = `${pluginId}/${LEGACY_MANIFEST_SUBPATH}`;

  if (resolvePackageFile(legacy) === null) return;

  throw new Error(
    `${ERROR_PREFIX} Plugin "${pluginId}" exports "${legacy}" but no "${pluginId}/${ROUTES_SUBPATH}". Plugin routes are now a nested tree in the plugin's own \`src/routes.ts\`: export \`routes = definePluginRoutes([...])\` built from \`page()\`, \`layout()\` and \`index()\`, with each module named by \`component: lazy(() => import("./pages/..."))\` instead of an \`entry\` string. See https://vitnode.com/docs/dev/plugins/routes.`,
  );
};

/** Where an app's own route files are, and which of them are not routes. */
interface HostRoutesConfig {
  dir: null | string;
  /** The router's own `routeFileIgnorePattern`, if it declares one. */
  ignore: null | RegExp;
}

const hostRoutesConfigFor = (
  appRoot: string,
  configured: null | string | undefined,
): HostRoutesConfig => {
  if (configured === null) return { dir: null, ignore: null };

  const declared = ((): { ignore?: unknown; routes?: unknown } => {
    try {
      const parsed: unknown = JSON.parse(
        readFileSync(pathsFor(appRoot).routerConfig, "utf8"),
      );

      if (typeof parsed !== "object" || parsed === null) return {};

      const config = parsed as {
        routeFileIgnorePattern?: unknown;
        routesDirectory?: unknown;
      };

      return {
        ignore: config.routeFileIgnorePattern,
        routes: config.routesDirectory,
      };
    } catch {
      // No `tsr.config.json`, or one that is not JSON.
      return {};
    }
  })();

  const ignore = ((): null | RegExp => {
    if (typeof declared.ignore !== "string" || declared.ignore.length === 0) {
      return null;
    }

    try {
      return new RegExp(declared.ignore);
    } catch {
      // Not a pattern this build can compile. The router will complain about it
      // in its own words; refusing to check anything here would be worse.
      return null;
    }
  })();

  if (configured !== undefined) {
    return { dir: resolvePath(appRoot, configured), ignore };
  }

  return {
    dir:
      typeof declared.routes === "string" && declared.routes.length > 0
        ? resolvePath(appRoot, declared.routes)
        : join(appRoot, DEFAULT_HOST_ROUTES_DIR),
    ignore,
  };
};

/** Every file under a directory, relative to it, in a deterministic order. */
const filesUnder = (directory: string, prefix = ""): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) => (a.name < b.name ? -1 : 1),
  );

  return entries.flatMap(entry => {
    if (entry.name.startsWith(".") || entry.name === "node_modules") return [];

    const here = prefix === "" ? entry.name : `${prefix}/${entry.name}`;

    return entry.isDirectory()
      ? filesUnder(join(directory, entry.name), here)
      : [here];
  });
};

/**
 * Every URL this application's own route files claim, or none.
 *
 * Read from the file *names* - nothing is imported and no router is loaded - and
 * silently empty when the app has no such directory, which is the correct answer
 * for a VitNode app on Vite that is not using a file-based router at all.
 */
const readHostRoutes = (
  appRoot: string,
  { dir, ignore }: HostRoutesConfig,
): HostRoutePath[] => {
  if (dir === null || !existsSync(dir)) return [];

  const prefix = relative(appRoot, dir).replaceAll(sep, "/");
  const files = filesUnder(dir).filter(
    file =>
      ignore === null || !(ignore.test(file) || ignore.test(join(dir, file))),
  );

  return hostRoutePathsFromFiles(files).map(hostRoute => ({
    ...hostRoute,
    // Relative to the app root, because that is the path an author would type
    // to open the file the diagnostic is telling them about.
    file: prefix === "" ? hostRoute.file : `${prefix}/${hostRoute.file}`,
  }));
};

/**
 * Which configured plugins export an optional browser-safe subpath.
 *
 * Resolution *is* the discovery: a plugin appears in a projection by exporting
 * the module and is silently absent otherwise, which is the same contract the
 * route manifest has and for the same reason - most plugins contribute neither
 * navigation nor content types, and an app that installs one must not fail to
 * build over it.
 *
 * Nothing is imported here. Both modules are browser-safe by contract but both
 * are also React - `admin/content` carries a plugin's editor fields and form
 * layouts outright - and a build tool has no business evaluating them: what a
 * generated file needs is a specifier, and a specifier is a string. The resolved
 * files are returned for the dev server to watch, so a plugin *gaining* one
 * while the server runs regenerates rather than requiring a restart.
 *
 * Ordered by the configured plugin list, and re-sorted by each generator - so
 * the bytes depend on which plugins are configured and on nothing else.
 *
 * ## The two subpaths are discovered independently, and that is the contract
 *
 * One call per projection, each asking only whether *its own* module resolves.
 * A plugin may export `admin/nav` and not `admin/content` - an AdminCP settings
 * screen that registers no content types - or `admin/content` and no navigation
 * beyond the entries its content types already imply, or neither. None of those
 * is a misconfiguration, and nothing anywhere compares the two resulting lists:
 * navigation describes what exists, a content registration describes how it is
 * edited, and they are separate concepts that happen to be discovered in one
 * pass over one configured plugin list.
 *
 * Exported for `./plugin-routes.test.ts`, which drives it with a synthetic
 * resolver - the only way to state the independence above without inventing two
 * fixture packages. Deliberately absent from `./index.ts`: this is not part of
 * `@vitnode/core/framework/vite`'s public surface.
 */
export const readOptionalPluginModules = <
  T extends { pluginId: string; specifier: string },
>(
  pluginIds: readonly string[],
  subpath: string,
  resolvePackageFile: (specifier: string) => null | string,
): { modules: T[]; watch: string[] } => {
  const modules: T[] = [];
  const watch: string[] = [];

  for (const pluginId of pluginIds) {
    const specifier = `${pluginId}/${subpath}`;
    const file = resolvePackageFile(specifier);

    if (file === null) continue;

    modules.push({ pluginId, specifier } as T);
    watch.push(file);
  }

  return { modules, watch };
};

/**
 * Fails the build for a page or layout module the plugin names and does not
 * have.
 *
 * The one check in this layer that cannot be pure, and the one thing a generated
 * file no longer does on the app's behalf: a page is reached through the literal
 * `import()` inside its own plugin's `lazy()` call, so nothing in the app's
 * source names it and nothing in the app's build resolves it until a visitor
 * navigates. Left unchecked, a mistyped page path is a broken chunk request in a
 * browser rather than a failed build.
 *
 * Best effort by construction, and deliberately so. `lazyImportSpecifier` reads
 * the specifier off the compiled callback and answers `null` for anything it
 * cannot be sure about - a bundler-rewritten import, a computed one, a bare
 * package specifier - and this skips those rather than guessing. A check that
 * failed a build over a callback it misread would be worse than no check.
 */
const assertComponentsImportable = (
  compiled: CompiledPluginRoutes,
  routesFiles: ReadonlyMap<string, string>,
): void => {
  for (const route of compiled.manifest) {
    const component = compiled.components.get(route.id);
    const specifier =
      component === undefined ? null : lazyImportSpecifier(component.load);
    const from = routesFiles.get(route.pluginId);

    if (specifier === null || from === undefined) continue;

    const file = resolvePath(dirname(from), specifier);
    const candidates = [
      file,
      `${file}.js`,
      `${file}.mjs`,
      join(file, "index.js"),
    ];

    if (candidates.some(candidate => existsSync(candidate))) continue;

    throw new Error(
      `${ERROR_PREFIX} Plugin "${route.pluginId}" declares the ${route.kind} at "${route.path}" with \`lazy(() => import("${specifier}"))\`, which does not resolve to a file next to ${relative(process.cwd(), from)}. Check the path and that ${route.pluginId}'s build output is up to date.`,
    );
  }
};

const discover = async (
  appRoot: string,
  options: VitNodePluginRoutesOptions,
  onLoaded?: (watch: string[]) => void,
) => {
  const paths = pathsFor(appRoot);
  const resolvePackageFile = resolverFor(appRoot);
  const pluginIds = await readConfiguredPluginIds(appRoot, paths.config);
  const loaded = await Promise.all(
    pluginIds.map(async pluginId =>
      readPluginRoutes(pluginId, resolvePackageFile),
    ),
  );
  const adminNav = readOptionalPluginModules<ResolvedAdminNavModule>(
    pluginIds,
    ADMIN_NAV_SUBPATH,
    resolvePackageFile,
  );
  const contentRegistry =
    readOptionalPluginModules<ResolvedContentRegistryModule>(
      pluginIds,
      ADMIN_CONTENT_SUBPATH,
      resolvePackageFile,
    );

  const watch = [
    ...loaded.flatMap(({ watch: file }) => file ?? []),
    ...adminNav.watch,
    ...contentRegistry.watch,
  ];

  onLoaded?.(watch);

  const compiled = compilePluginRoutes({
    hostRoutes: readHostRoutes(
      appRoot,
      hostRoutesConfigFor(appRoot, options.hostRoutesDir),
    ),
    sources: loaded.map(({ source }) => source),
  });

  assertComponentsImportable(
    compiled,
    new Map(
      loaded.flatMap(({ source, watch: file }) =>
        file === null ? [] : [[source.pluginId, file] as const],
      ),
    ),
  );

  return {
    adminNav: adminNav.modules,
    compiled,
    contentRegistry: contentRegistry.modules,
    watch,
  };
};

const writeIfChanged = async (path: string, source: string): Promise<void> => {
  const current = existsSync(path) ? await readFile(path, "utf8") : null;

  if (current !== source) await writeFile(path, source, "utf8");
};

const removeIfPresent = async (path: string): Promise<void> => {
  if (!existsSync(path)) return;

  await unlink(path);
};

/** All three generated files, from one discovery pass. */
const writeGenerated = async (
  appRoot: string,
  options: VitNodePluginRoutesOptions,
  onLoaded?: (watch: string[]) => void,
): Promise<void> => {
  const paths = pathsFor(appRoot);
  const { adminNav, compiled, contentRegistry } = await discover(
    appRoot,
    options,
    onLoaded,
  );

  await Promise.all([
    writeIfChanged(paths.registry, compiled.source),
    writeIfChanged(paths.adminNav, generateAdminNavSource(adminNav)),
    writeIfChanged(
      paths.contentRegistry,
      generateContentRegistrySource(contentRegistry),
    ),
    removeIfPresent(paths.staleManifest),
  ]);
};

export const vitNodePluginRoutes = (
  options: VitNodePluginRoutesOptions,
): Plugin => {
  const { appRoot } = options;
  const configPath = pathsFor(appRoot).config;
  const routesDir = hostRoutesConfigFor(appRoot, options.hostRoutesDir).dir;

  return {
    config: async () => {
      await writeGenerated(appRoot, options);
    },

    configureServer: server => {
      const watched = new Set<string>([configPath]);

      const queue = createGenerationQueue(
        async () =>
          writeGenerated(appRoot, options, files => {
            files.forEach(file => watched.add(file));
            server.watcher.add(files);
          }),
        error => {
          server.config.logger.error(String(error));
        },
      );

      const isRelevant = (file: string, existenceOnly: boolean): boolean => {
        if (watched.has(file)) return true;
        if (!existenceOnly || routesDir === null) return false;

        return (
          file.startsWith(`${routesDir}${sep}`) && /\.[cm]?[jt]sx?$/.test(file)
        );
      };

      const onExistenceChange = (file: string) => {
        if (isRelevant(file, true)) queue.request();
      };

      server.watcher.add(configPath);
      queue.request();
      server.watcher.on("add", onExistenceChange);
      server.watcher.on("unlink", onExistenceChange);
      server.watcher.on("change", file => {
        if (isRelevant(file, false)) queue.request();
      });
    },
    name: "vitnode:plugin-routes",
  };
};
