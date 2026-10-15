import { isLucideIconName } from "./emoji-icon";

/**
 * How AdminCP → System → Plugins presents a plugin, written by its author in
 * `src/plugin-info.ts`. Plain data, so the API and the browser can both
 * import it.
 */
export interface PluginInfo {
  /** A Lucide icon name, such as `"newspaper"` - https://lucide.dev/icons. */
  icon?: string;
  /** Human-readable title. Defaults to the package name. */
  title?: string;
}

export interface PluginAuthor {
  email: null | string;
  name: string;
  url: null | string;
}

/**
 * Everything the AdminCP plugin catalog knows about a plugin, as
 * `vitnode build` and `vitnode dev` write it into `src/manifest.gen.ts`:
 * `id`, `author`, `description`, `license` and `version` from `package.json`, `title` and `icon`
 * from the plugin's own `src/plugin-info.ts`.
 */
export interface PluginManifest<Id extends string = string> {
  author: null | PluginAuthor;
  /** `description` from `package.json`, or `null` when it has none. */
  description: null | string;
  /** A Lucide icon name, or `null` for the default icon. */
  icon: null | string;
  /** `name` from `package.json` - which is the plugin id. */
  id: Id;
  license: null | string;
  /** The plugin's title, falling back to `name`. */
  title: string;
  /** `version` from `package.json`, or `null` when it has none. */
  version: null | string;
}

export const PLUGIN_MANIFEST_ERROR_PREFIX = "[VitNode plugin manifest]";

/**
 * Refuses a manifest generated for a different package than the one
 * registering it - a copied `config.tsx`, or an inventory entry that drifted
 * from the package name - and an icon that is not a Lucide name. Either way the catalog would
 * otherwise show something the plugin never meant.
 */
export const assertPluginManifest = (
  pluginId: string,
  manifest: Pick<PluginManifest, "icon" | "id"> | undefined,
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
};

/** One plugin the web build registered, as its generated inventory lists it. */
export interface FrontendPluginInventoryEntry {
  id: string;
  /** `null` for a plugin registered without a generated manifest. */
  manifest: null | PluginManifest;
}

/**
 * The plugins an app's `vitnode.config.ts` registers, written by the web build
 * to `src/plugin-inventory.gen.ts` as plain data. Handing it to
 * `buildApiConfig({ frontendPlugins })` is how the API learns what the browser
 * runs - it cannot see that configuration itself.
 */
export type FrontendPluginInventory = readonly FrontendPluginInventoryEntry[];
