/** Core's own id, spelled here so the generator does not import app config. */
export const CORE_PLUGIN_ID = "@vitnode/core";

/**
 * Where core's own route tree is imported from.
 *
 * The same shape a plugin's routes module is reached by - `<pluginId>/routes` -
 * and resolved the same way, through the package's `exports` map. Core is not a
 * configured plugin, so this is the one route source in a generated
 * `plugin-routes.gen.ts` that does not depend on an app's plugin list.
 */
export const CORE_ROUTES_SPECIFIER = `${CORE_PLUGIN_ID}/routes`;
