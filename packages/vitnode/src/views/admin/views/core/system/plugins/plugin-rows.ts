import type { PluginTone } from "./plugin-tone";
import type {
  AdminComponentUpdate,
  AdminPluginUpdates,
} from "./plugin-updates-query";
import type {
  AdminInstalledPlugin,
  AdminInstalledPlugins,
  AdminPluginAuthor,
} from "./plugins-query";

import { pluginToneOf } from "./plugin-tone";

export interface PluginRow {
  author: AdminPluginAuthor | null;
  description: null | string;
  icon: null | string;
  id: string;
  kind: "core" | "plugin";
  license: null | string;
  registrations: AdminInstalledPlugin["registrations"] | null;
  title: string;
  tone: null | PluginTone;
  update: AdminComponentUpdate | undefined;
  version: null | string;
  versionMismatch: boolean;
}

export const pluginRowsOf = ({
  core,
  data,
  updates,
}: {
  core: { description: string; id: string; title: string };
  data: AdminInstalledPlugins;
  updates: AdminPluginUpdates | undefined;
}): PluginRow[] => {
  const enabled = updates?.enabled ?? true;
  const updateById = new Map(
    (updates?.plugins ?? []).map(update => [update.id, update]),
  );

  return [
    {
      author: data.core.author,
      description: core.description,
      icon: null,
      id: core.id,
      kind: "core",
      license: data.core.license,
      registrations: null,
      title: core.title,
      tone: pluginToneOf(updates?.core, enabled),
      update: updates?.core,
      version: data.core.version,
      versionMismatch: false,
    },
    ...data.plugins.map(plugin => {
      const update = updateById.get(plugin.id);

      return {
        author: plugin.author,
        description: plugin.description,
        icon: plugin.icon,
        id: plugin.id,
        kind: "plugin" as const,
        license: plugin.license,
        registrations: plugin.registrations,
        title: plugin.title,
        tone: pluginToneOf(update, enabled),
        update,
        version: plugin.version,
        versionMismatch: plugin.versionMismatch,
      };
    }),
  ];
};
