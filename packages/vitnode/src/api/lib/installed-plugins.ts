import type {
  FrontendPluginInventory,
  PluginAuthor,
  PluginManifest,
} from "@/lib/plugin-manifest";

import { assertPluginManifest } from "@/lib/plugin-manifest";
import { manifest as coreManifest } from "@/manifest";

export interface InstalledPluginRegistration {
  version: null | string;
}

export type InstalledPluginAuthor = Pick<PluginAuthor, "name" | "url">;

export interface InstalledPlugin {
  author: InstalledPluginAuthor | null;
  description: null | string;
  icon: null | string;
  id: string;
  license: null | string;
  registrations: {
    api: InstalledPluginRegistration | null;
    frontend: InstalledPluginRegistration | null;
  };
  title: string;
  version: null | string;
  versionMismatch: boolean;
}

export interface InstalledPluginRegistry {
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

export const authorOf = (
  manifest: null | Pick<PluginManifest, "author">,
): InstalledPluginAuthor | null =>
  manifest?.author
    ? { name: manifest.author.name, url: manifest.author.url ?? null }
    : null;

const registrationOf = (
  registration: Registration | undefined,
): InstalledPluginRegistration | null =>
  registration === undefined
    ? null
    : { version: registration.manifest?.version ?? null };

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
        author: authorOf(manifest),
        description: manifest?.description ?? null,
        icon: manifest?.icon ?? null,
        id,
        license: manifest?.license ?? null,
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
