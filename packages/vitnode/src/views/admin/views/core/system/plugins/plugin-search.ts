import type { AdminInstalledPlugin } from "./plugins-query";

/** Case-insensitive, across what an administrator would type: title, id, description. */
export const matchesPluginSearch = (
  plugin: Pick<AdminInstalledPlugin, "description" | "id" | "title">,
  search: string,
): boolean => {
  const needle = search.trim().toLowerCase();
  if (needle === "") return true;

  return [plugin.title, plugin.id, plugin.description ?? ""].some(value =>
    value.toLowerCase().includes(needle),
  );
};
