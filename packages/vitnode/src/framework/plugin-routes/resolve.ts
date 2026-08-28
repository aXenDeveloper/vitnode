import type {
  PluginRouteEntryDeclaration,
  PluginRouteEntrySource,
  ResolvedPluginRouteModule,
} from "./types.js";

import { pluginRouteId } from "../../routing/manifest.js";

/**
 * What every error from this module is prefixed with.
 *
 * These are build-time failures - a plugin declared a route the app cannot
 * import - and they surface in a Vite config hook, where the stack is all
 * bundler internals. The prefix is what makes the message findable.
 */
const ERROR_PREFIX = "[VitNode plugin routes]";

/**
 * A plugin id, which in VitNode is also the package name the route module is
 * imported from - `@vitnode/example`, `my-plugin`.
 *
 * Matched rather than trusted because it is concatenated into an import
 * specifier that is then written into a source file. Everything npm allows in a
 * name is allowed here; nothing else is, which rules out quotes, whitespace,
 * newlines, backslashes and `..` in one go.
 */
const PLUGIN_ID_PATTERN =
  /^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** One path segment: no dots-only segments, so `.` and `..` cannot appear. */
const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * An extension on an entry, which is always a mistake.
 *
 * A plugin's export map maps subpaths to build output - `"./*"` to
 * `"./dist/src/*.js"` - so the subpath is extensionless. `"routes/page.tsx"`
 * would resolve to `dist/src/routes/page.tsx.js` and fail with a message about a
 * file nobody wrote, so it is worth naming here instead.
 */
const ENTRY_EXTENSION_PATTERN = /\.[cm]?[jt]sx?$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const assertSegmentedPath = ({
  label,
  source,
  value,
}: {
  label: string;
  source: string;
  value: string;
}): void => {
  if (value === "" || value !== value.trim()) {
    throw new Error(
      `${ERROR_PREFIX} ${source} declares a route with ${label} ${JSON.stringify(value)}, which is empty or padded with whitespace.`,
    );
  }

  const segments = value.split("/");
  const invalid = segments.filter(segment => !SEGMENT_PATTERN.test(segment));

  if (invalid.length > 0) {
    throw new Error(
      `${ERROR_PREFIX} ${source} declares a route with ${label} ${JSON.stringify(value)}. Use "/"-separated segments of letters, digits, ".", "_" and "-" - a leading "/", a "." or ".." segment, a backslash or a quote is never valid, because this is written into a generated import.`,
    );
  }
};

/** Validates a plugin id and returns it unchanged, so it can be used inline. */
export const assertPluginId = (pluginId: string, source: string): string => {
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new Error(
      `${ERROR_PREFIX} ${source} declares the plugin id ${JSON.stringify(pluginId)}, which is not a package name. A route module is imported from the plugin's package, so the id has to be one.`,
    );
  }

  return pluginId;
};

/**
 * Turns a JavaScript string into a single-quoted TypeScript literal.
 *
 * Every value that reaches this has already been matched against a pattern that
 * cannot contain a quote, a backslash or a newline, so in practice it escapes
 * nothing. It exists anyway, and is tested directly: this is a code generator,
 * and a code generator that concatenates unescaped strings is one refactor away
 * from writing whatever a plugin's `package.json` says into an app's source.
 */
export const toSingleQuotedLiteral = (value: string): string =>
  `'${value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")}'`;

/**
 * Reads the configured plugin ids out of an already-loaded `vitnode.config.ts`.
 *
 * The app's config is the source of truth for which plugins exist, so it is also
 * the source of truth for whose routes get bundled: a plugin that is installed
 * but not listed here contributes nothing, and no `node_modules` scan can
 * accidentally put it back.
 *
 * Pure, and separate from the loading, so the narrowing every generated build
 * depends on is testable without a module loader. `source` only ever appears in
 * error messages - it is the config's path, which the caller knows and this
 * does not.
 */
export const pluginIdsFromLoadedConfig = (
  loaded: unknown,
  source: string,
): string[] => {
  if (!isRecord(loaded) || !isRecord(loaded.vitNodeConfig)) {
    throw new Error(
      `${ERROR_PREFIX} ${source} does not export \`vitNodeConfig\`. It has to, because the configured plugins are what the route registry is generated from.`,
    );
  }

  const { plugins } = loaded.vitNodeConfig;

  if (!Array.isArray(plugins)) {
    throw new Error(
      `${ERROR_PREFIX} \`vitNodeConfig.plugins\` in ${source} is not an array.`,
    );
  }

  return plugins.map((plugin: unknown, index) => {
    if (!isRecord(plugin) || typeof plugin.pluginId !== "string") {
      throw new Error(
        `${ERROR_PREFIX} \`vitNodeConfig.plugins[${index}]\` in ${source} has no string \`pluginId\`.`,
      );
    }

    return assertPluginId(plugin.pluginId, source);
  });
};

/**
 * Reads the route declarations out of an already-loaded plugin route manifest.
 *
 * Pure for the same reason as {@link pluginIdsFromLoadedConfig}, and equally
 * strict: a manifest that exports the wrong shape has to fail here, with the
 * specifier in the message, rather than three steps later as a generated file
 * that will not compile.
 */
export const routeDeclarationsFromManifest = (
  loaded: unknown,
  source: string,
): PluginRouteEntryDeclaration[] => {
  if (!isRecord(loaded) || !("routes" in loaded)) {
    throw new Error(
      `${ERROR_PREFIX} ${source} does not export \`routes\`. A plugin route manifest exports an array of \`{ id, entry }\`.`,
    );
  }

  const { routes } = loaded;

  if (!Array.isArray(routes)) {
    throw new Error(`${ERROR_PREFIX} \`routes\` in ${source} is not an array.`);
  }

  return routes.map((route: unknown, index) => {
    if (
      !isRecord(route) ||
      typeof route.id !== "string" ||
      typeof route.entry !== "string"
    ) {
      throw new Error(
        `${ERROR_PREFIX} \`routes[${index}]\` in ${source} is not a \`{ id: string, entry: string }\` record.`,
      );
    }

    return { entry: route.entry, id: route.id };
  });
};

/**
 * Every configured plugin's declarations, validated and put in a fixed order.
 *
 * Two guarantees, and both are the reason this is a separate step rather than
 * something the generator does inline:
 *
 * - **Deterministic.** The result is sorted by key with a code-unit comparison,
 *   not `localeCompare`, so it does not depend on the machine's locale, on the
 *   order the plugins were configured in, or on the order any directory was read
 *   in. The same configuration produces the same bytes.
 * - **Loud.** A malformed id, an entry with a `..` segment or an extension, and
 *   two declarations claiming one key all throw here - at build time, naming the
 *   plugin - rather than turning into a generated import that fails somewhere in
 *   a browser.
 *
 * It stops at what can be decided from the declarations alone. Whether
 * `<pluginId>/<entry>` actually resolves to a file is a filesystem question, and
 * the caller that owns the filesystem asks it, using `specifier`.
 */
export const resolvePluginRouteModules = (
  sources: readonly PluginRouteEntrySource[],
): ResolvedPluginRouteModule[] => {
  const modules: ResolvedPluginRouteModule[] = [];

  for (const source of sources) {
    const pluginId = assertPluginId(source.pluginId, "vitnode.config.ts");

    for (const route of source.routes ?? []) {
      assertSegmentedPath({ label: "id", source: pluginId, value: route.id });
      assertSegmentedPath({
        label: "entry",
        source: pluginId,
        value: route.entry,
      });

      if (ENTRY_EXTENSION_PATTERN.test(route.entry)) {
        throw new Error(
          `${ERROR_PREFIX} ${pluginId} declares the entry ${JSON.stringify(route.entry)} with a file extension. An entry is a package export subpath, and a plugin's export map adds the extension - drop it.`,
        );
      }

      modules.push({
        entry: route.entry,
        key: pluginRouteId(pluginId, route.id),
        pluginId,
        routeId: route.id,
        specifier: `${pluginId}/${route.entry}`,
      });
    }
  }

  return sortAndAssertUnique(modules);
};

/**
 * Sorts by key and rejects duplicates.
 *
 * Also applied by the generator, so a caller cannot hand it an unsorted list and
 * get a file whose bytes depend on argument order.
 */
export const sortAndAssertUnique = (
  modules: ResolvedPluginRouteModule[],
): ResolvedPluginRouteModule[] => {
  const sorted = [...modules].sort((a, b) => {
    if (a.key === b.key) return 0;

    return a.key < b.key ? -1 : 1;
  });

  const duplicates = sorted
    .filter(
      (module, index) => index > 0 && module.key === sorted[index - 1].key,
    )
    .map(module => module.key);

  if (duplicates.length > 0) {
    throw new Error(
      `${ERROR_PREFIX} Two route declarations claim the same registry key: ${[...new Set(duplicates)].map(key => JSON.stringify(key)).join(", ")}. A key is \`<pluginId>:<routeId>\`, so give the routes different ids.`,
    );
  }

  return sorted;
};
