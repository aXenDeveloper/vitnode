import { isLucideIconName } from "./emoji-icon";
import { updateSourceUrlProblem } from "./updates/source-url";

/**
 * The parts of a plugin's manifest its package.json cannot express. A plugin
 * exports it as `pluginInfo` from `src/plugin-info.ts`; `vitnode build` and
 * `vitnode dev` merge it into the generated `src/manifest.gen.ts`.
 *
 * @example
 * ```ts
 * import type { PluginInfo } from "@vitnode/core/lib/plugin-manifest";
 *
 * export const pluginInfo: PluginInfo = { title: "Blog", icon: "newspaper" };
 * ```
 */
export interface PluginInfo {
  /** A Lucide icon name in kebab case, e.g. `newspaper`, shown in the AdminCP. */
  icon?: string;
  /** The plugin's display name. Defaults to the package name. */
  title?: string;
  /** Where the AdminCP checks for newer versions of the plugin. */
  updates?: PluginUpdateSource;
}

export interface PluginAuthor {
  email: null | string;
  name: string;
  url: null | string;
}

export interface PluginUpdateSource {
  /** An absolute `https://` URL of a public update manifest, without credentials, query or fragment. */
  url: string;
}

/**
 * A plugin's identity, generated into `src/manifest.gen.ts` from its
 * package.json (`name`, `version`, `description`, `author`, `license`) and
 * {@link PluginInfo}. Never written by hand.
 *
 * Pass the same object to `buildPlugin`, `buildApiPlugin` and `bindApiPlugin`:
 * its `id` is the plugin id every frontend and API registration is keyed by.
 */
export interface PluginManifest<Id extends string = string> {
  author: null | PluginAuthor;
  description: null | string;
  /** A Lucide icon name, or `null` for the default icon. */
  icon: null | string;
  /** The package name, e.g. `@vitnode/blog`. */
  id: Id;
  license: null | string;
  title: string;
  /** Missing on manifests generated before update checks existed: same as `null`. */
  updates?: null | PluginUpdateSource;
  version: null | string;
}

export const PLUGIN_MANIFEST_ERROR_PREFIX = "[VitNode plugin manifest]";

/**
 * Checks a manifest passed to a plugin factory; `where` names the factory in
 * the error. A missing manifest passes.
 *
 * @throws When the manifest's `id` is not `pluginId`, its icon is not a Lucide
 * icon name, or its update source URL is not a valid public `https://` URL.
 */
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
