import type {
  FrontendPluginInventory,
  PluginManifest,
} from "@/lib/plugin-manifest";

import { assertPluginManifest } from "@/lib/plugin-manifest";
import { manifest as coreManifest } from "@/manifest";

/** One side's registration of a plugin, as far as the catalog cares. */
export interface InstalledPluginRegistration {
  /** `null` when that registration carries no manifest, or no version. */
  version: null | string;
}

export interface InstalledPlugin {
  description: null | string;
  /** A Lucide icon name, or `null` for the default icon. */
  icon: null | string;
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
  manifest: null | PluginManifest;
}

const ERROR_PREFIX = "[VitNode plugins]";

const byId = (
  entries: readonly { id: string; manifest: null | PluginManifest }[],
  side: string,
): Map<string, Registration> => {
  const map = new Map<string, Registration>();

  for (const { id, manifest } of entries) {
    // Core is shown on its own, above the list, and is not a plugin to count.
    if (id === coreManifest.id) continue;

    if (map.has(id)) {
      throw new Error(
        `${ERROR_PREFIX} Two ${side} plugins claim the same id: ${JSON.stringify(id)}. A plugin id is the package name, so an app cannot configure one twice.`,
      );
    }

    assertPluginManifest(id, manifest ?? undefined, `The ${side} config`);
    map.set(id, { manifest });
  }

  return map;
};

const registrationOf = (
  registration: Registration | undefined,
): InstalledPluginRegistration | null =>
  registration === undefined
    ? null
    : { version: registration.manifest?.version ?? null };

/**
 * Every configured plugin once, keyed by id and sorted by it: the API's own
 * registrations merged with the frontend inventory the web build generated.
 *
 * Built once at boot - the configured plugins cannot change without a restart -
 * and from nothing but those two lists, so `node_modules` is never scanned and
 * a package that is installed but not configured is not listed.
 *
 * A side without a manifest is an unknown version, never a mismatch: only two
 * known, different versions mean the web build and the API run different code.
 */
export const buildInstalledPluginRegistry = ({
  api,
  frontend,
}: {
  api: readonly { manifest?: PluginManifest; pluginId: string }[];
  frontend: FrontendPluginInventory | undefined;
}): InstalledPluginRegistry => {
  const apiPlugins = byId(
    api.map(plugin => ({
      id: plugin.pluginId,
      manifest: plugin.manifest ?? null,
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
      const apiVersion = fromApi?.manifest?.version ?? null;
      const frontendVersion = fromFrontend?.manifest?.version ?? null;
      const manifest = fromApi?.manifest ?? fromFrontend?.manifest ?? null;

      return {
        description: manifest?.description ?? null,
        icon: manifest?.icon ?? null,
        id,
        registrations: {
          api: registrationOf(fromApi),
          frontend: registrationOf(fromFrontend),
        },
        title: manifest?.title ?? id,
        version: apiVersion ?? frontendVersion,
        versionMismatch:
          apiVersion !== null &&
          frontendVersion !== null &&
          apiVersion !== frontendVersion,
      };
    }),
  };
};
