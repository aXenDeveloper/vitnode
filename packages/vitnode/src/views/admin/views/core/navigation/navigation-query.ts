import { queryOptions } from "@tanstack/react-query";

import type {
  NavigationKind,
  NavigationPreset,
  NavigationText,
} from "@/lib/navigation";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { CONFIG_PLUGIN } from "@/config";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import {
  ADMIN_NAVIGATION_SCREEN,
  adminScopedQueryKey,
  adminScopedQueryRoot,
} from "@/views/admin/views/core/shared/admin-scope";

export interface AdminNavigationItem {
  createdAt: Date | string;
  description: NavigationText[];
  href: null | string;
  icon: null | string;
  id: number;
  isOpenInNewTab: boolean;
  kind: NavigationKind;
  parentId: null | number;
  pluginId: null | string;
  position: number;
  preset: NavigationPreset | null;
  presetId: null | string;
  title: NavigationText[];
  updatedAt: Date | string;
}

export interface AdminNavigationList {
  items: AdminNavigationItem[];
}

export interface AdminNavigationPresets {
  presets: NavigationPreset[];
}

export const fetchAdminNavigation = async (): Promise<AdminNavigationList> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "admin/navigation",
    path: "/list",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the navigation list");
  }

  return await response.json();
};

export const fetchAdminNavigationPresets =
  async (): Promise<AdminNavigationPresets> => {
    const response = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "admin/navigation",
      path: "/presets",
    });

    if (!response.ok) {
      throw new AdminRequestError(response.status, "the navigation presets");
    }

    return await response.json();
  };

export const adminNavigationQueryRoot = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_NAVIGATION_SCREEN, adminUserId);

export const adminNavigationQueryOptions = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) =>
  queryOptions({
    queryFn: fetchAdminNavigation,
    queryKey: adminScopedQueryKey(ADMIN_NAVIGATION_SCREEN, adminUserId, "list"),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export const adminNavigationPresetsQueryOptions = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) =>
  queryOptions({
    queryFn: fetchAdminNavigationPresets,
    queryKey: adminScopedQueryKey(
      ADMIN_NAVIGATION_SCREEN,
      adminUserId,
      "presets",
    ),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });
