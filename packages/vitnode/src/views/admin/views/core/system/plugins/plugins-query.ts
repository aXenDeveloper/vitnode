import { queryOptions } from "@tanstack/react-query";

import { CONFIG_PLUGIN } from "@/config";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

export interface AdminPluginRegistration {
  version: null | string;
}

export interface AdminInstalledPlugin {
  description: null | string;
  icon: null | string;
  id: string;
  registrations: {
    api: AdminPluginRegistration | null;
    frontend: AdminPluginRegistration | null;
  };
  title: string;
  version: null | string;
  versionMismatch: boolean;
}

export interface AdminInstalledPlugins {
  core: { version: string };
  frontendInventory: boolean;
  plugins: AdminInstalledPlugin[];
}

export type InstalledPluginsFetcher = () => Promise<AdminInstalledPlugins>;

export const fetchInstalledPlugins: InstalledPluginsFetcher = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "admin/plugins",
    path: "/",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the plugin catalog");
  }

  return await response.json();
};

export const installedPluginsQueryKey = adminQueryRoot("plugins");

export const installedPluginsQueryOptions = () =>
  queryOptions({
    queryFn: async () => await fetchInstalledPlugins(),
    queryKey: installedPluginsQueryKey,
    retry: false,
    // The list changes only when the application is rebuilt and restarted.
    staleTime: Infinity,
  });
