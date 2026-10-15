import { isLucideIconName } from "./emoji-icon";

/**
 * How AdminCP → System → Plugins presents a plugin, written by its author in
 * `src/plugin-metadata.ts`. Plain data, so the API and the browser can both
 * import it.
 */
export interface PluginInfo {
  /** A Lucide icon name, such as `"newspaper"` - https://lucide.dev/icons. */
  icon?: string;
  /** Human-readable title. Defaults to the package name. */
  title?: string;
}

/**
 * Everything the AdminCP plugin catalog knows about a plugin, as
 * `vitnode build` and `vitnode dev` write it into `src/plugin-metadata.gen.ts`:
 * `id`, `description` and `version` from `package.json`, `title` and `icon`
 * from the plugin's own `src/plugin-metadata.ts`.
 */
export interface PluginMetadata {
  /** `description` from `package.json`, or `null` when it has none. */
  description: null | string;
  /** A Lucide icon name, or `null` for the default icon. */
  icon: null | string;
  /** `name` from `package.json` - which is the plugin id. */
  id: string;
  /** The plugin's title, falling back to `name`. */
  title: string;
  /** `version` from `package.json`, or `null` when it has none. */
  version: null | string;
}

export const PLUGIN_METADATA_ERROR_PREFIX = "[VitNode plugin metadata]";

/**
 * Refuses metadata generated for a different package than the one registering
 * it - a copied `config.tsx`, or a `pluginId` that drifted from the package
 * name - and an icon that is not a Lucide name. Either way the catalog would
 * otherwise show something the plugin never meant.
 */
export const assertPluginMetadata = (
  pluginId: string,
  metadata: Pick<PluginMetadata, "icon" | "id"> | undefined,
  where: string,
): void => {
  if (metadata === undefined) return;

  if (metadata.id !== pluginId) {
    throw new Error(
      `${PLUGIN_METADATA_ERROR_PREFIX} ${where} registers the plugin "${pluginId}" with the metadata of "${metadata.id}". The metadata comes from the package's own package.json, whose "name" is the plugin id - pass the \`pluginMetadata\` of this plugin's own \`src/plugin-metadata.gen.ts\`, or make \`pluginId\` match the package name.`,
    );
  }

  if (metadata.icon !== null && !isLucideIconName(metadata.icon)) {
    throw new Error(
      `${PLUGIN_METADATA_ERROR_PREFIX} ${where} gives the plugin "${pluginId}" the icon ${JSON.stringify(metadata.icon)}. An icon is a Lucide icon name such as "newspaper" - set it in the plugin's \`src/plugin-metadata.ts\`.`,
    );
  }
};

/** One plugin the web build registered, as its generated inventory lists it. */
export interface FrontendPluginInventoryEntry {
  id: string;
  /** `null` for a plugin registered without generated metadata. */
  metadata: null | PluginMetadata;
}

/**
 * The plugins an app's `vitnode.config.ts` registers, written by the web build
 * to `src/plugin-inventory.gen.ts` as plain data. Handing it to
 * `buildApiConfig({ frontendPlugins })` is how the API learns what the browser
 * runs - it cannot see that configuration itself.
 */
export type FrontendPluginInventory = readonly FrontendPluginInventoryEntry[];
