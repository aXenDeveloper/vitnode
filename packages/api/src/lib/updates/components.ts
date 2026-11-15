import type {
  FrontendPluginInventory,
  PluginManifest,
} from "@/lib/plugin-manifest";

import type { InstalledPluginRegistry } from "../installed-plugins";
import type { UpdateComponentVersions } from "./evaluate";

import { normalizeInstalledVersions } from "./evaluate";

export interface UpdateComponent extends UpdateComponentVersions {
  id: string;
  kind: "core" | "plugin";
  /** `null` when the package declares no update source: checking is unavailable. */
  sourceUrl: null | string;
}

/**
 * Core first, then every plugin the catalog lists. A plugin's versions are the
 * ones its registrations report - API and web app - so a stale side is checked
 * too. Its update source comes from the API manifest, else the web app's.
 */
export const collectUpdateComponents = ({
  api,
  core,
  frontend,
  registry,
}: {
  api: readonly { manifest?: PluginManifest; pluginId: string }[];
  core: Pick<PluginManifest, "id" | "updates" | "version">;
  frontend: FrontendPluginInventory | undefined;
  registry: InstalledPluginRegistry;
}): UpdateComponent[] => {
  const sources = new Map<string, string>();
  for (const entry of frontend ?? []) {
    const url = entry.manifest?.updates?.url;
    if (url) sources.set(entry.id, url);
  }
  for (const plugin of api) {
    const url = plugin.manifest?.updates?.url;
    if (url) sources.set(plugin.pluginId, url);
  }

  return [
    {
      id: core.id,
      kind: "core",
      sourceUrl: core.updates?.url ?? null,
      ...normalizeInstalledVersions([core.version]),
    },
    ...registry.plugins.map(plugin => {
      const { api: fromApi, frontend: fromFrontend } = plugin.registrations;
      const reported = [fromApi, fromFrontend].flatMap(registration =>
        registration === null ? [] : [registration.version],
      );

      return {
        id: plugin.id,
        kind: "plugin" as const,
        sourceUrl: sources.get(plugin.id) ?? null,
        ...normalizeInstalledVersions(reported),
      };
    }),
  ];
};
