import type { newBuildPluginApiCore } from "@/api/plugin";

export interface ApiPluginRegistry {
  "@vitnode/core": typeof newBuildPluginApiCore;
}
