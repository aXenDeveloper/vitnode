import type { PluginRow } from "./plugin-list";
import type { AdminPluginUpdates } from "./plugin-updates-query";
import type { AdminInstalledPlugins } from "./plugins-query";

import { pluginToneOf } from "./plugin-tone";

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
