import { PluginRouteError } from "../../routing/errors.js";

export const PLUGIN_ROUTES_ERROR_PREFIX = "[VitNode plugin routes]";

export const annotatePluginRouteError = (
  error: unknown,
  routesSpecifiers: ReadonlyMap<string, string>,
): unknown => {
  if (!(error instanceof PluginRouteError)) return error;

  const parts = [`${PLUGIN_ROUTES_ERROR_PREFIX} ${error.message}`];
  const declaredIn = routesSpecifiers.get(error.pluginId);

  if (declaredIn !== undefined) {
    parts.push(`Declared in "${declaredIn}".`);
  }

  if (error.conflictsWith) {
    const otherIn = routesSpecifiers.get(error.conflictsWith.pluginId);

    parts.push(
      otherIn === undefined
        ? `It conflicts with "${error.conflictsWith.routeId}".`
        : `The route it conflicts with, "${error.conflictsWith.routeId}", is declared in "${otherIn}".`,
    );
  }

  return new PluginRouteError(parts.join(" "), {
    code: error.code,
    conflictsWith: error.conflictsWith,
    path: error.path,
    pluginId: error.pluginId,
    routeId: error.routeId,
  });
};

/**
 * Runs a step of the compilation with {@link annotatePluginRouteError} applied.
 *
 * A wrapper rather than a `try`/`catch` at each call site, so every step of the
 * compiler is annotated the same way and adding one cannot mean forgetting to.
 */
export const withPluginRouteDiagnostics = <T>(
  routesSpecifiers: ReadonlyMap<string, string>,
  step: () => T,
): T => {
  try {
    return step();
  } catch (error) {
    throw annotatePluginRouteError(error, routesSpecifiers);
  }
};
