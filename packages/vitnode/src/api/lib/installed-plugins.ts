import type {
  FrontendPluginInventory,
  PluginMetadata,
} from "@/lib/plugin-metadata";

import { CONFIG_PLUGIN } from "@/config";
import { assertPluginMetadataId } from "@/lib/plugin-metadata";

/** One side's registration of a plugin, as far as the catalog cares. */
export interface InstalledPluginRegistration {
  /** `null` when that registration carries no metadata, or no version. */
  version: null | string;
}

export interface InstalledPlugin {
  description: null | string;
  id: string;
  registrations: {
    api: InstalledPluginRegistration | null;
    /** `null` also when the API was not given the frontend inventory. */
    frontend: InstalledPluginRegistration | null;
  };
  title: string;
  /** The known version, the API's first. `null` when neither side knows it. */
  version: null | string;
  /** Both sides report a version, and not the same one. */
  versionMismatch: boolean;
}

export interface InstalledPluginRegistry {
  /** Whether the frontend registrations are known at all. */
  frontendInventory: boolean;
  plugins: InstalledPlugin[];
}

interface Registration {
  metadata: null | PluginMetadata;
}

const ERROR_PREFIX = "[VitNode plugins]";

const byId = (
  entries: readonly { id: string; metadata: null | PluginMetadata }[],
  side: string,
): Map<string, Registration> => {
  const map = new Map<string, Registration>();

  for (const { id, metadata } of entries) {
    // Core is shown on its own, above the list, and is not a plugin to count.
    if (id === CONFIG_PLUGIN.pluginId) continue;

    if (map.has(id)) {
      throw new Error(
        `${ERROR_PREFIX} Two ${side} plugins claim the same id: ${JSON.stringify(id)}. A plugin id is the package name, so an app cannot configure one twice.`,
      );
    }

    assertPluginMetadataId(id, metadata ?? undefined, `The ${side} config`);
    map.set(id, { metadata });
  }

  return map;
};

const registrationOf = (
  registration: Registration | undefined,
): InstalledPluginRegistration | null =>
  registration === undefined
    ? null
    : { version: registration.metadata?.version ?? null };

/**
 * Every configured plugin once, keyed by id and sorted by it: the API's own
 * registrations merged with the frontend inventory the web build generated.
 *
 * Built once at boot - the configured plugins cannot change without a restart -
 * and from nothing but those two lists, so `node_modules` is never scanned and
 * a package that is installed but not configured is not listed.
 *
 * A side without metadata is an unknown version, never a mismatch: only two
 * known, different versions mean the web build and the API run different code.
 */
export const buildInstalledPluginRegistry = ({
  api,
  frontend,
}: {
  api: readonly { metadata?: PluginMetadata; pluginId: string }[];
  frontend: FrontendPluginInventory | undefined;
}): InstalledPluginRegistry => {
  const apiPlugins = byId(
    api.map(plugin => ({
      id: plugin.pluginId,
      metadata: plugin.metadata ?? null,
    })),
    "API",
  );
  const frontendPlugins = byId(frontend ?? [], "frontend");
  const ids = [...new Set([...apiPlugins.keys(), ...frontendPlugins.keys()])];
  ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    frontendInventory: frontend !== undefined,
    plugins: ids.map(id => {
      const fromApi = apiPlugins.get(id);
      const fromFrontend = frontendPlugins.get(id);
      const apiVersion = fromApi?.metadata?.version ?? null;
      const frontendVersion = fromFrontend?.metadata?.version ?? null;
      const metadata = fromApi?.metadata ?? fromFrontend?.metadata ?? null;

      return {
        description: metadata?.description ?? null,
        id,
        registrations: {
          api: registrationOf(fromApi),
          frontend: registrationOf(fromFrontend),
        },
        title: metadata?.title ?? id,
        version: apiVersion ?? frontendVersion,
        versionMismatch:
          apiVersion !== null &&
          frontendVersion !== null &&
          apiVersion !== frontendVersion,
      };
    }),
  };
};
