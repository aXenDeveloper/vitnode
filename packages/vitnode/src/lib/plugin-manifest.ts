import { isLucideIconName } from "./emoji-icon";
import { updateSourceUrlProblem } from "./updates/source-url";

export interface PluginInfo {
  icon?: string;
  title?: string;
  updates?: PluginUpdateSource;
}

export interface PluginAuthor {
  email: null | string;
  name: string;
  url: null | string;
}

export interface PluginUpdateSource {
  url: string;
}

export interface PluginManifest<Id extends string = string> {
  author: null | PluginAuthor;
  description: null | string;
  icon: null | string;
  id: Id;
  license: null | string;
  title: string;
  /** Missing on manifests generated before update checks existed: same as `null`. */
  updates?: null | PluginUpdateSource;
  version: null | string;
}

export const PLUGIN_MANIFEST_ERROR_PREFIX = "[VitNode plugin manifest]";

export const assertPluginManifest = (
  pluginId: string,
  manifest: Pick<PluginManifest, "icon" | "id" | "updates"> | undefined,
  where: string,
): void => {
  if (manifest === undefined) return;

  if (manifest.id !== pluginId) {
    throw new Error(
      `${PLUGIN_MANIFEST_ERROR_PREFIX} ${where} registers the plugin "${pluginId}" with the manifest of "${manifest.id}". The manifest comes from the package's own package.json, whose "name" is the plugin id - pass the \`manifest\` of this plugin's own \`src/manifest.gen.ts\`.`,
    );
  }

  if (manifest.icon !== null && !isLucideIconName(manifest.icon)) {
    throw new Error(
      `${PLUGIN_MANIFEST_ERROR_PREFIX} ${where} gives the plugin "${pluginId}" the icon ${JSON.stringify(manifest.icon)}. An icon is a Lucide icon name such as "newspaper" - set it in the plugin's \`src/plugin-info.ts\`.`,
    );
  }

  const updatesUrl = manifest.updates?.url;
  if (updatesUrl !== undefined) {
    const problem = updateSourceUrlProblem(updatesUrl);
    if (problem !== null) {
      throw new Error(
        `${PLUGIN_MANIFEST_ERROR_PREFIX} ${where} gives the plugin "${pluginId}" the update source ${JSON.stringify(updatesUrl)}, which ${problem}. Set \`updates.url\` in the plugin's \`src/plugin-info.ts\`.`,
      );
    }
  }
};

export interface FrontendPluginInventoryEntry {
  id: string;
  manifest: null | PluginManifest;
}

export type FrontendPluginInventory = readonly FrontendPluginInventoryEntry[];
