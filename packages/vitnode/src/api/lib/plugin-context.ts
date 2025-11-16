let currentPluginId: string | undefined;

export const setCurrentPluginId = (pluginId: string) => {
  currentPluginId = pluginId;
};

export const getCurrentPluginId = () => {
  if (!currentPluginId) {
    throw new Error(
      "Plugin ID is not defined. Ensure that your plugin config sets it before building modules or routes.",
    );
  }

  return currentPluginId;
};
