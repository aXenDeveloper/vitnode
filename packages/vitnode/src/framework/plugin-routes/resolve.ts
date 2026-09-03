import type { ResolvedPluginRoutesModule } from "./types.js";

import { PLUGIN_ROUTES_ERROR_PREFIX as ERROR_PREFIX } from "./diagnostics.js";

/**
 * A plugin id, which in VitNode is also the package name its routes module is
 * imported from - `@vitnode/example`, `my-plugin`.
 *
 * Matched rather than trusted because it is concatenated into an import
 * specifier that is then written into a source file. Everything npm allows in a
 * name is allowed here; nothing else is, which rules out quotes, whitespace,
 * newlines, backslashes and `..` in one go.
 */
const PLUGIN_ID_PATTERN =
  /^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Validates a plugin id and returns it unchanged, so it can be used inline. */
export const assertPluginId = (pluginId: string, source: string): string => {
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new Error(
      `${ERROR_PREFIX} ${source} declares the plugin id ${JSON.stringify(pluginId)}, which is not a package name. A plugin's routes module is imported from the plugin's package, so the id has to be one.`,
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
        `${ERROR_PREFIX} \`vitNodeConfig.plugins[${String(index)}]\` in ${source} has no string \`pluginId\`.`,
      );
    }

    return assertPluginId(plugin.pluginId, source);
  });
};

/**
 * The route tree out of an already-loaded plugin `routes` module.
 *
 * Strict about the *module* and deliberately incurious about the tree: a module
 * that exports no `routes`, or a `routes` that is not an array, is named here
 * with its specifier in the message. What each node then means is
 * `flattenPluginRoutes`' to decide, and it reads every field defensively from
 * `unknown` - two readers rather than one shared narrowed shape, so neither
 * layer has to know what the other requires.
 *
 * A plugin still exporting the flat `routes/manifest` shape - records with an
 * `entry`, an `id` and a `kind` - is named as such, because the generated file
 * would otherwise fail to compile with a type error nobody in the app wrote.
 */
export const routeDeclarationsFromRoutesModule = (
  loaded: unknown,
  source: string,
): unknown[] => {
  if (!isRecord(loaded) || !("routes" in loaded)) {
    throw new Error(
      `${ERROR_PREFIX} ${source} does not export \`routes\`. A plugin's routes module is \`export const routes = definePluginRoutes([...])\`.`,
    );
  }

  const { routes } = loaded;

  if (!Array.isArray(routes)) {
    throw new Error(`${ERROR_PREFIX} \`routes\` in ${source} is not an array.`);
  }

  const legacy = (routes as unknown[]).filter(
    route => isRecord(route) && typeof route.entry === "string",
  );

  if (legacy.length > 0) {
    throw new Error(
      `${ERROR_PREFIX} ${source} exports the old flat route manifest - ${String(legacy.length)} route${legacy.length === 1 ? "" : "s"} declaring an \`entry\`. Plugin routes are now a nested tree: replace each record with \`page()\`, \`layout()\` or \`index()\` from \`@vitnode/core/routing\`, move \`entry\` to \`component: lazy(() => import("./pages/..."))\`, rename \`namespaces\` to \`messages\`, and drop \`id\`, \`kind\`, \`parentId\` and \`searchEntry\`. See https://vitnode.com/docs/dev/plugins/routes.`,
    );
  }

  return routes as unknown[];
};

/**
 * Sorts the resolved routes modules by plugin id and rejects duplicates.
 *
 * Deterministic on purpose: the result is sorted with a code-unit comparison
 * rather than `localeCompare`, so the generated bytes do not depend on the
 * machine's locale or on the order the plugins were configured in.
 */
export const sortAndAssertUniquePlugins = (
  modules: readonly ResolvedPluginRoutesModule[],
): ResolvedPluginRoutesModule[] => {
  const sorted = [...modules].sort((a, b) => {
    if (a.pluginId === b.pluginId) return 0;

    return a.pluginId < b.pluginId ? -1 : 1;
  });

  const duplicates = sorted
    .filter(
      (module, index) =>
        index > 0 && module.pluginId === sorted[index - 1].pluginId,
    )
    .map(module => module.pluginId);

  if (duplicates.length > 0) {
    throw new Error(
      `${ERROR_PREFIX} Two plugins claim the same id: ${[...new Set(duplicates)].map(id => JSON.stringify(id)).join(", ")}. A plugin id is the package name, so an app cannot configure one twice.`,
    );
  }

  return sorted;
};
