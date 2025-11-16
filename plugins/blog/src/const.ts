import { setCurrentPluginId } from "@vitnode/core/api/lib/plugin-context";

export const CONFIG_PLUGIN = {
  pluginId: "@vitnode/blog" as const,
};

setCurrentPluginId(CONFIG_PLUGIN.pluginId);
