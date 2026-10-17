import type {
  AdminComponentUpdate,
  AdminPluginUpdates,
} from "@/views/admin/views/core/system/plugins/plugin-updates-query";
import type { AdminInstalledPlugins } from "@/views/admin/views/core/system/plugins/plugins-query";

export interface UpdateEntry {
  id: string;
  security: boolean;
  title: string;
  version: null | string;
}

interface UpdateGroups {
  other: UpdateEntry[];
  security: UpdateEntry[];
}

const entryOf = (
  update: AdminComponentUpdate,
  title: string,
): null | UpdateEntry => {
  const result = update.result;
  if (result === null) return null;

  const security = result.securityUpdates.length > 0;
  const available = result.status === "update_available";
  if (!security && !available) return null;

  return {
    id: update.id,
    security,
    title,
    version:
      (available ? result.latest?.version : null) ??
      result.securityUpdates.find(finding => finding.fixed !== null)?.fixed ??
      null,
  };
};

export const updateGroupsOf = ({
  coreTitle,
  plugins,
  updates,
}: {
  coreTitle: string;
  plugins: AdminInstalledPlugins["plugins"] | undefined;
  updates: AdminPluginUpdates;
}): UpdateGroups => {
  const titleById = new Map(
    (plugins ?? []).map(plugin => [plugin.id, plugin.title]),
  );
  const entries = [
    entryOf(updates.core, coreTitle),
    ...updates.plugins.map(update =>
      entryOf(update, titleById.get(update.id) ?? update.id),
    ),
  ].filter(entry => entry !== null);

  return {
    other: entries.filter(entry => !entry.security),
    security: entries.filter(entry => entry.security),
  };
};
