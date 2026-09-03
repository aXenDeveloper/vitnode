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

/**
 * Where a plugin declares its routes, as a package export subpath.
 *
 * `@vitnode/example/routes`, backed by the plugin's own `src/routes.ts`. A
 * plugin that does not export it - `@vitnode/blog` today - simply contributes no
 * routes. That is not an error: most plugins are AdminCP content types and ship
 * no pages at all, and a missing routes module has to mean "none" rather than
 * failing the build of every app that installs one.
 */
const ROUTES_SUBPATH = "routes";

/**
 * Where a plugin declared its routes before they were a tree.
 *
 * Resolved for one reason: to say so. A plugin still shipping the flat manifest
 * has an `entry`, an `id`, a `kind` and a `parentId` per route, and no adapter
 * can turn those into `lazy(() => import(...))` - the module a page lives in was
 * a string the *app* imported, and it is now the plugin's own literal import.
 * Left undetected, such a plugin contributes nothing at all and the page simply
 * 404s.
 */
const LEGACY_MANIFEST_SUBPATH = "routes/manifest";

/**
 * Where a plugin declares its AdminCP navigation, as a package export subpath.
 *
 * Optional in exactly the way the route manifest is: a plugin that does not
 * export it contributes no sidebar entries, which is the right answer for most
 * plugins and must not fail the build of every app that installs one.
 *
 * A **browser-safe** module by contract - ids, hrefs, permissions, icons and
 * content type definitions, and nothing that renders a screen. It is imported by
 * the application's bundle rather than read here, so what this pass does with it
 * is only ask whether it resolves.
 */
const ADMIN_NAV_SUBPATH = "admin/nav";

/**
 * Where a plugin declares its Content Engine frontend registrations, as a
 * package export subpath.
 *
 * Optional in exactly the way `admin/nav` is, and absent for the same reason:
 * most plugins register no content types, and a missing module has to mean
 * "none" rather than failing the build of every app that installs one.
 *
 * A **browser-safe** module by contract - content type definitions, icons, and
 * the components that override a generated field, table cell or form layout. It
 * carries React components, which is precisely why the generated file imports it
 * by a literal specifier instead of serialising anything: this pass only ever
 * asks whether it resolves.
 */
const ADMIN_CONTENT_SUBPATH = "admin/content";

const ERROR_PREFIX = "[VitNode plugin routes]";

/** Where a file-based router keeps an app's own route files, by convention. */
const DEFAULT_HOST_ROUTES_DIR = join("src", "routes");

export interface VitNodePluginRoutesOptions {
  /**
   * The application's root directory - the one holding its `package.json` and
   * its `src/`.
   *
   * The one thing this plugin cannot work out for itself, and the reason it is
   * required rather than defaulted to `process.cwd()`: a Vite config is loaded
   * with the working directory set to wherever the command was run, which in a
   * monorepo is regularly the repository root. Every path below hangs off this,
   * as does the package resolution, so guessing it wrong means reading somebody
   * else's config and writing generated files into a directory nothing imports.
   *
   *     vitNodePluginRoutes({ appRoot: import.meta.dirname })
   */
  appRoot: string;
  /**
   * Where this app's own route files live, for the collision check.
   *
   * Defaults to the file-based router's own answer: `routesDirectory` from
   * `tsr.config.json` if the app has one, and `src/routes` otherwise. Pass a
   * path to override it, or `null` to turn the build-time check off - the
   * runtime one, which reads the real route tree, is unaffected either way.
   */
  hostRoutesDir?: null | string;
}

/** Everything the plugin reads and writes, derived from the app root. */
const pathsFor = (appRoot: string) => ({
  /** The configured plugin list, and the only place it is read from. */
  config: join(appRoot, "src", "vitnode.config.ts"),
  /**
   * The AdminCP navigation projection: one literal import per configured plugin
   * that has navigation to declare. Committed and rewritten like the other two,
   * and written from the same pass over the same configured plugin list - so a
   * plugin removed from the config loses its sidebar entries and its routes in
   * one step rather than two.
   */
  adminNav: join(appRoot, "src", "admin-nav.gen.ts"),
  /**
   * The Content Engine frontend registry: one literal import per configured
   * plugin that registers content types. Written from the same pass over the
   * same configured plugin list as the other three, so a plugin removed from
   * the config loses its routes, its sidebar entries and its content screens in
   * one step rather than three.
   */
  contentRegistry: join(appRoot, "src", "content-registry.gen.ts"),
  /**
   * The plugin route registry: one static import per configured plugin that
   * declares routes, and the trees they declared. Committed, and rewritten only
   * when it changes.
   */
  registry: join(appRoot, "src", "plugin-routes.gen.ts"),
  /**
   * The data file the registry replaced.
   *
   * Deleted rather than ignored. It was a literal copy of every route's manifest
   * entry, and a route's `entry` and `searchEntry` are not fields a plugin has
   * any more - so a stale copy left in `src/` is a file that still compiles,
   * still imports `@vitnode/core/routing`, and describes routes the app no
   * longer has.
   */
  staleManifest: join(appRoot, "src", "plugin-route-manifest.gen.ts"),
  /** The file-based router's config, read only for where the routes are. */
  routerConfig: join(appRoot, "tsr.config.json"),
});

/**
 * Resolution as the *application* would do it, honouring each package's
 * `exports`.
 *
 * `createRequire` rather than `import.meta.resolve`, and the difference matters:
 * every VitNode plugin maps `"./*"` to `"./dist/src/*.js"`, and
 * `import.meta.resolve` answers a *pattern* match without ever touching the
 * disk - it happily returns a URL for `@vitnode/example/routes/nope`. The CJS
 * resolver stats the file, so a wrong entry is caught here instead of becoming a
 * 404 in a browser. `existsSync` is checked anyway, because being wrong about
 * this is the failure mode this whole step exists to prevent.
 *
 * Anchored on the app's `package.json` rather than on this module, which is what
 * makes the answer the same one the app's own bundler will get. Anchoring it
 * here would resolve a plugin from *this package's* `node_modules` - a different
 * tree, and in a hoisted install possibly a different copy.
 */
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

/**
 * The plugins this app is configured with, in configuration order.
 *
 * `jiti` because `vitnode.config.ts` is TypeScript that imports other TypeScript
 * without extensions, which Node's own type stripping will not load. It is the
 * same loader `vitnode`'s own CLI scripts use to read this file.
 *
 * A plugin that is installed but not listed here is not consulted, and nothing
 * ever enumerates `node_modules` - so disabling a plugin removes its routes from
 * the bundle by construction rather than by a filter somebody has to remember.
 *
 * Rooted at the app's `package.json`, for the same reason the resolver above is:
 * the config's own imports have to resolve the way they will for the app.
 *
 * ## Why the module cache is off
 *
 * The same trap `readPluginRoutes` below busts with a versioned URL, one layer
 * up and with a worse symptom. `jiti`'s module cache is keyed by filename and
 * shared across instances, so a *fresh* `createJiti` per pass is not a fresh
 * read: the second regeneration of a dev-server session gets back the config
 * Node evaluated when the server started. Editing `vitnode.config.ts` then does
 * nothing at all - and because the plugin list is what decides *which* manifests
 * are read, a plugin removed from the config keeps its routes in both generated
 * files, and in the running route tree, until the server is restarted.
 *
 * `moduleCache: false` is the whole fix. It costs a re-execution of the config
 * and its imports on every pass - about 3ms here, against a watcher event rather
 * than a request - because `fsCache` still keeps the transpilation. A versioned
 * specifier like the one below is not available: jiti resolves a path, not a
 * URL, so there is nowhere to hang the version.
 */
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

/**
 * One plugin's route tree, loaded from its compiled `routes` module.
 *
 * A route tree is browser-safe data by contract - paths, shells, message lists
 * and one `lazy()` per page - so this is a normal `import()` of the plugin's
 * build output in Node. No page, no layout, no React and no router is evaluated
 * to find out which routes exist: `lazy()` stores the import callback without
 * calling it, which is the whole point of it.
 *
 * `routeDeclarationsFromRoutesModule` checks the *module* is a routes module at
 * all - it exports a `routes` array - and names the specifier when it is not.
 * What each node then means is `flattenPluginRoutes`' to decide, and the array is
 * handed on untouched for it: it validates every field it reads, defensively,
 * from `unknown`. Two readers rather than one shared narrowed shape, so neither
 * layer has to know what the other requires.
 *
 * A plugin with no `routes` module contributes nothing, and one still shipping
 * the old flat `routes/manifest` is told so rather than silently contributing
 * nothing - see {@link LEGACY_MANIFEST_SUBPATH}.
 *
 * ## Why the URL carries an mtime
 *
 * Node's ESM loader caches modules by URL, permanently and with no eviction. The
 * dev server therefore had a watcher that worked and a regeneration that could
 * not: edit a plugin's routes, the watcher fires, a regeneration pass runs, and
 * `import()` of the same URL hands back the module Node parsed minutes ago - so
 * the generated file was rewritten from stale declarations, or more often not
 * rewritten at all because the bytes had not changed.
 *
 * A version taken off the file itself is the smallest thing that fixes it and
 * keeps every property that matters: it changes when the file changes, so an
 * untouched module keeps its cache entry across regenerations rather than
 * leaking a new one, and it is read off disk rather than invented, so two builds
 * of the same tree ask for the same URL. It never reaches the generated output -
 * the generated bytes are a function of the configured plugins alone - so the
 * browser never sees any of this.
 *
 * `./module-version` is the rule itself, and why it is a fingerprint rather
 * than a clock. `statSync` is here because this is the layer that has a
 * filesystem.
 */
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

/**
 * Where the app's own route files are, as its file-based router sees it.
 *
 * `tsr.config.json` is read rather than assumed, and both of the fields that
 * decide *which files are routes* are honoured, because a check that disagreed
 * with the router about that would fail a build over a file the router never
 * turned into a route. `routeFileIgnorePattern` in particular is what an app
 * reaches for when something that is not a page ends up in its routes directory.
 *
 * A malformed or absent config is not an error here - it means "the default",
 * which is what a router without one would do too.
 */
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

/**
 * Everything the generated files are built from, discovered at build time only.
 *
 * `Promise.all` over the configured ids keeps the result independent of which
 * manifest happens to load first, and the compiler sorts on top of that - so the
 * bytes depend on the configuration and nothing else.
 *
 * The split here is the one this whole layer is arranged around: *this* function
 * owns the filesystem - the config, the plugins' route modules, the app's own
 * route files, package resolution - and `compilePluginRoutes` owns every decision
 * made from what it finds. Which is why the only thing left below it is the one
 * check that cannot be pure: does each lazily imported page resolve to a file
 * that exists.
 *
 * `onLoaded` is called with the files this pass read *before* anything can fail,
 * so a dev server watching them still learns about a routes module that threw -
 * which is exactly the one an author is about to edit again.
 */
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

/**
 * Writes a generated file, and only if it changed.
 *
 * The write-if-changed is load bearing, not an optimisation: these files live in
 * `src/`, so rewriting identical bytes on every dev-server event would trip
 * Vite's watcher and reload the page in a loop - the same trap two route
 * generators writing `routeTree.gen.ts` fall into.
 */
const writeIfChanged = async (path: string, source: string): Promise<void> => {
  const current = existsSync(path) ? await readFile(path, "utf8") : null;

  if (current !== source) await writeFile(path, source, "utf8");
};

/**
 * Removes a generated file this build no longer writes.
 *
 * Only ever pointed at a path VitNode itself generated, and only when that file
 * has been replaced rather than merely emptied: a stale generated module in
 * `src/` still compiles and still describes routes, which is a worse failure
 * than a missing one.
 */
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

/**
 * Build-time discovery of the route modules an app's plugins ship -
 * `@vitnode/core/framework/vite`.
 *
 * The boundary this plugin exists to draw:
 *
 * - **Here, at build time.** Read the configured plugins, load their route
 *   manifests from `node_modules`, check every entry resolves to a real file,
 *   validate every route, reject two plugins claiming one URL and a plugin
 *   claiming one of the app's own, then write `src/plugin-routes.gen.ts` - one
 *   static import per plugin that exports a `routes` module - and, from the same
 *   configured plugin list, `src/admin-nav.gen.ts` and
 *   `src/content-registry.gen.ts`.
 * - **In the browser.** Import those three files. They contain literal data,
 *   literal `import()` calls and literal specifiers and nothing else - no
 *   `node:fs`, no package resolution, no validation to repeat and no specifier
 *   built from a variable, and so nothing a bundler cannot follow.
 *
 * Routes and navigation are discovered in one pass and stay separate concepts:
 * neither generated file is derived from the other, and a plugin may have a
 * sidebar entry with no route, a route with no entry, or both.
 *
 * Nothing is copied. The plugin's page stays in the plugin, compiled in its own
 * `dist`, and the app holds one generated line of registration per route.
 *
 * Everything about this is the same for every VitNode app on Vite, which is why
 * it ships here rather than being a file each one keeps a copy of. The only
 * thing an application supplies is where it lives.
 */
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
    /**
     * Regenerates while the dev server runs, so editing a plugin's manifest is
     * enough. Adding or removing a plugin in `vitnode.config.ts` is picked up
     * too, and so is adding one of the app's own route files - which is the
     * event that can turn a legal plugin route into a collision.
     *
     * A manifest that did not exist when the server started is not watched,
     * because there is no file to watch yet; restart for that, exactly as
     * installing a plugin already requires. A manifest that existed and was
     * *replaced* - which is what rebuilding a plugin does to its `dist` - is,
     * because a file this pass has ever read stays watched even after it is
     * deleted.
     */
    configureServer: server => {
      const watched = new Set<string>([configPath]);

      /**
       * The regeneration chain, and the one pass allowed to be waiting on it.
       *
       * Regeneration is asynchronous - it resolves several manifests and writes
       * four files - and the watcher can fire many times before the first pass
       * finishes. Run concurrently, two passes interleave and the *older* one can
       * perform the last write, leaving generated files that describe a manifest
       * that no longer exists until something else happens to touch it.
       *
       * `createGenerationQueue` is that rule and only that rule: passes are
       * chained rather than parallel, and at most one is queued behind the
       * running one, because a pass re-reads everything from disk when it starts
       * and so the queued one sees the final state whether it was asked for once
       * or forty times. That is what keeps a `dist` rebuild - which rewrites
       * every file a plugin has - from queueing a pass per file. See
       * `./generation-queue.ts`, where it is stated without a dev server so it
       * can be tested.
       */
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

      /**
       * Whether a file this pass sees can change what the generated files say.
       *
       * The config and any manifest ever read, for the obvious reason. Route
       * *files* of the app only by their existence - a route file's contents
       * cannot move the URL it claims, which is in its name - so a change to one
       * is ignored and an add or a delete is not.
       */
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
