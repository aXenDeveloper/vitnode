import type { PluginInfo } from "@vitnode/core/lib/plugin-manifest";

/**
 * The blog's AdminCP title, Lucide icon and update source, merged into the
 * generated `src/manifest.gen.ts`.
 */
export const pluginInfo: PluginInfo = {
  title: "Blog",
  icon: "newspaper",
  updates: {
    url: "https://raw.githubusercontent.com/aXenDeveloper/vitnode/update-manifest/updates.json",
  },
};
