import { PluginRouteError } from "../../routing/errors.js";

/**
 * What every build-time plugin route failure is prefixed with.
 *
 * These surface from inside a Vite config hook, where the stack is all bundler
 * internals and the message is the only thing a plugin author will read. The
 * prefix is what makes it findable, and it is one constant rather than a string
 * each module spells for itself so that grepping for it finds all of them.
 */
export const PLUGIN_ROUTES_ERROR_PREFIX = "[VitNode plugin routes]";

/**
 * A build-time failure, with the two things only the build knows added to it.
 *
 * `@vitnode/core/routing` validates a route and throws a {@link PluginRouteError}
 * naming the plugin, the route and - on a collision - the route it collided
 * with. What it cannot name is **which file to open**: it is handed plain data
 * and has no idea it came from `@vitnode/example/routes/manifest`, or that the
 * other side of a collision came from a different package entirely. The build
 * knows both, because it is what loaded them.
 *
 * So the message a plugin author actually sees is assembled here:
 *
 *     [VitNode plugin routes] Plugin route path collision on "/example" (main):
 *     @vitnode/example already owns "/example" as "@vitnode/example:example-page",
 *     and @vitnode/blog declares "/example" as "@vitnode/blog:example".
 *     Two plugins cannot serve the same path - rename one of them.
 *     Declared in "@vitnode/blog/routes/manifest".
 *     The route it conflicts with is declared in "@vitnode/example/routes/manifest".
 *
 * A new error rather than a mutated one, and a `PluginRouteError` rather than a
 * plain `Error`: `code`, `pluginId`, `routeId` and `path` are structured fields a
 * build tool may render its own way, and losing them here would mean the
 * annotation cost the caller the machine-readable half of the failure.
 *
 * Anything that is not a `PluginRouteError` is returned untouched - the resolver
 * and the parity check write their own messages, already prefixed.
 *
 * ## Every field survives, including the ones this function does not read
 *
 * A `PluginRouteError` is reconstructed rather than mutated, which means the copy
 * is where a field gets silently dropped. `conflictsWithHostRoute` is carried for
 * that reason and not because anything here uses it: the host-route collision
 * arrives with the app's own file in that field, and the only reason it passes
 * through this function at all is to gain the manifest annotation below. Losing
 * the field on the way would trade one half of the diagnostic for the other.
 */
export const annotatePluginRouteError = (
  error: unknown,
  manifestSpecifiers: ReadonlyMap<string, string>,
): unknown => {
  if (!(error instanceof PluginRouteError)) return error;

  const parts = [`${PLUGIN_ROUTES_ERROR_PREFIX} ${error.message}`];
  const declaredIn = manifestSpecifiers.get(error.pluginId);

  if (declaredIn !== undefined) {
    parts.push(`Declared in "${declaredIn}".`);
  }

  if (error.conflictsWith) {
    const otherIn = manifestSpecifiers.get(error.conflictsWith.pluginId);

    parts.push(
      otherIn === undefined
        ? `It conflicts with "${error.conflictsWith.routeId}".`
        : `The route it conflicts with, "${error.conflictsWith.routeId}", is declared in "${otherIn}".`,
    );
  }

  return new PluginRouteError(parts.join(" "), {
    code: error.code,
    conflictsWith: error.conflictsWith,
    conflictsWithHostRoute: error.conflictsWithHostRoute,
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
  manifestSpecifiers: ReadonlyMap<string, string>,
  step: () => T,
): T => {
  try {
    return step();
  } catch (error) {
    throw annotatePluginRouteError(error, manifestSpecifiers);
  }
};
