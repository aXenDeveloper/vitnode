/**
 * What a plugin's `package.json` says about it, as `vitnode build` and
 * `vitnode dev` write it into the plugin's `src/plugin-metadata.gen.ts`.
 *
 * Plain data on purpose: the API and the browser both import it, so it carries
 * no React, no Node and no image - the icon travels separately, see
 * {@link PluginIconLoader}.
 */
export interface PluginMetadata {
  /** `description` from `package.json`, or `null` when it has none. */
  description: null | string;
  /** `name` from `package.json` - which is the plugin id. */
  id: string;
  /** `vitnode.title`, falling back to `name`. */
  title: string;
  /** `version` from `package.json`, or `null` when it has none. */
  version: null | string;
}

/**
 * The plugin's icon as a `data:` URL, or `null` when `package.json` declares
 * none. Lazy, so the bytes reach the browser only on the screen that shows
 * them - `() => import("./plugin-icon.gen")`.
 */
export type PluginIconLoader = () => Promise<{ default: null | string }>;

export const PLUGIN_METADATA_ERROR_PREFIX = "[VitNode plugin metadata]";

/**
 * Refuses metadata generated for a different package than the one registering
 * it - a copied `config.tsx`, or a `pluginId` that drifted from the package
 * name. Either way the catalog would otherwise report another package's
 * version under this plugin's id.
 */
export const assertPluginMetadataId = (
  pluginId: string,
  metadata: Pick<PluginMetadata, "id"> | undefined,
  where: string,
): void => {
  if (metadata === undefined || metadata.id === pluginId) return;

  throw new Error(
    `${PLUGIN_METADATA_ERROR_PREFIX} ${where} registers the plugin "${pluginId}" with the metadata of "${metadata.id}". The metadata comes from the package's own package.json, whose "name" is the plugin id - pass the \`pluginMetadata\` of this plugin's own \`src/plugin-metadata.gen.ts\`, or make \`pluginId\` match the package name.`,
  );
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
