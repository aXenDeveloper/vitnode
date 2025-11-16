import { setCurrentPluginId } from "@/api/lib/plugin-context";

export const CONFIG_PLUGIN = {
  pluginId: "@vitnode/core" as const,
  version: "2.0.0-canary.0",
};

setCurrentPluginId(CONFIG_PLUGIN.pluginId);
