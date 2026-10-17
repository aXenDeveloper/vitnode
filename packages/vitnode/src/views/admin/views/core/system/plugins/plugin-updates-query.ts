import type { z } from "zod";

import { queryOptions } from "@tanstack/react-query";

import type {
  componentUpdateSchema,
  updatesOverviewSchema,
} from "@/api/modules/admin/plugins/routes/updates.schema";

import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";

import { installedPluginsQueryKey } from "./plugins-query";

export type AdminPluginUpdates = z.infer<typeof updatesOverviewSchema>;
export type AdminComponentUpdate = z.infer<typeof componentUpdateSchema>;

export type PluginUpdatesFetcher = () => Promise<AdminPluginUpdates>;

export const fetchPluginUpdates: PluginUpdatesFetcher = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/plugins",
    path: "/updates",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the plugin update status");
  }

  return await response.json();
};

export const pluginUpdatesQueryKey = [
  ...installedPluginsQueryKey,
  "updates",
] as const;

export const pluginUpdatesQueryOptions = () =>
  queryOptions({
    queryFn: async () => await fetchPluginUpdates(),
    queryKey: pluginUpdatesQueryKey,
    retry: false,
    staleTime: 60_000,
  });

export type CheckPluginUpdatesResult =
  | {
      failedSources: number;
      securityUpdates: number;
      status: "completed";
      updates: number;
    }
  | {
      retryAfterSeconds: null | number;
      status: "cooldown" | "disabled" | "interrupted" | "running";
    }
  | { status: "error" };

export type CheckPluginUpdates = () => Promise<CheckPluginUpdatesResult>;

export const checkPluginUpdates: CheckPluginUpdates = async () => {
  try {
    const response = await fetcher({
      plugin: manifest.id,
      method: "post",
      module: "admin/plugins",
      path: "/updates/check",
    });

    if (
      response.status === 200 ||
      response.status === 409 ||
      response.status === 429
    ) {
      return await response.json();
    }

    return { status: "error" };
  } catch {
    return { status: "error" };
  }
};
