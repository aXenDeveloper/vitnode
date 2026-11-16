import { CORE_PLUGIN_ID } from "../framework/plugin-routes/core";

const ERROR_PREFIX = "[VitNode plugin routes]";

const PLUGIN_ID_PATTERN =
  /^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Validates a plugin id and returns it unchanged, so it can be used inline. */
export const assertPluginId = (pluginId: string, source: string): string => {
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new Error(
      `${ERROR_PREFIX} ${source} declares the plugin id ${JSON.stringify(pluginId)}, which is not a package name. A plugin's routes module is imported from the plugin's package, so the id has to be one.`,
    );
  }

  // Core's own routes are prepended to every app's registry, so a plugin
  // claiming this id would be a second source under one name - and the duplicate
  // check downstream would blame the app's configuration for something VitNode
  // added.
  if (pluginId === CORE_PLUGIN_ID) {
    throw new Error(
      `${ERROR_PREFIX} ${source} configures a plugin with the id ${JSON.stringify(CORE_PLUGIN_ID)}, which is core's own. Core's routes are registered by VitNode itself - give the plugin its own package name.`,
    );
  }

  return pluginId;
};
