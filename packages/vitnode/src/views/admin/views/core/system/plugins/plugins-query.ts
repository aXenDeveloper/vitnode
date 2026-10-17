import { queryOptions } from "@tanstack/react-query";

import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

export interface AdminPluginRegistration {
  version: null | string;
}

export interface AdminPluginAuthor {
  name: string;
  url: null | string;
}

export interface AdminInstalledPlugin {
  author: AdminPluginAuthor | null;
  description: null | string;
  icon: null | string;
  id: string;
  license: null | string;
  registrations: {
    api: AdminPluginRegistration | null;
    frontend: AdminPluginRegistration | null;
  };
  title: string;
  version: null | string;
  versionMismatch: boolean;
}

export interface AdminInstalledPlugins {
  core: {
    author: AdminPluginAuthor | null;
    license: null | string;
    version: string;
  };
  frontendInventory: boolean;
  plugins: AdminInstalledPlugin[];
}

export type InstalledPluginsFetcher = () => Promise<AdminInstalledPlugins>;

export const fetchInstalledPlugins: InstalledPluginsFetcher = async () => {
  const response = await fetcher({
    plugin: manifest.id,
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
    staleTime: Infinity,
  });
