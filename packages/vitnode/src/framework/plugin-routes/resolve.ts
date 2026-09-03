import type { ResolvedPluginRoutesModule } from "./types.js";

import { PLUGIN_ROUTES_ERROR_PREFIX as ERROR_PREFIX } from "./diagnostics.js";

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
