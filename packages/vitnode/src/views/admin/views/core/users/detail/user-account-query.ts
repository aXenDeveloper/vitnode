import { queryOptions } from "@tanstack/react-query";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { SsoConnectionsApi } from "@/views/auth/settings/sso/sso-connections-query";
import type { NotificationPreferenceTypeView } from "@/views/notifications/notifications-query";

import { CONFIG_PLUGIN } from "@/config";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";

import { adminUserQueryKey } from "./user-query";

export interface AdminUserDevice {
  browser: null | string;
  deviceType: "desktop" | "mobile" | "tablet";
  expiresAt: Date | string;
  ipAddress: string;
  lastSeen: Date | string;
  os: null | string;
  publicId: string;
  sessionKinds: ("admin" | "user")[];
}

export interface AdminUserPasskey {
  backedUp: boolean;
  createdAt: Date | string;
  deviceType: "multiDevice" | "singleDevice";
  id: number;
  lastUsedAt: Date | null | string;
  name: string;
  transports: string[];
}

interface AdminUserAccountKey {
  adminUserId: AdminIdentity;
  userId: number;
}

const accountKey = (
  { adminUserId, userId }: AdminUserAccountKey,
  part: string,
) => [...adminUserQueryKey({ adminUserId, id: String(userId) }), part] as const;

export const adminUserDevicesQueryKey = (key: AdminUserAccountKey) =>
  accountKey(key, "devices");

export const adminUserPasskeysQueryKey = (key: AdminUserAccountKey) =>
  accountKey(key, "passkeys");

export const adminUserSsoQueryKey = (key: AdminUserAccountKey) =>
  accountKey(key, "sso");

export const adminUserNotificationsQueryKey = (key: AdminUserAccountKey) =>
  accountKey(key, "notifications");

const params = (userId: number) => ({ id: String(userId) });

export const fetchAdminUserDevices = async (
  userId: number,
): Promise<AdminUserDevice[]> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: params(userId) },
    method: "get",
    module: "admin/users",
    path: "/{id}/devices",
  });
  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "a user's devices",
      `id=${userId}`,
    );
  }

  return (await response.json()).devices;
};

export const fetchAdminUserPasskeys = async (
  userId: number,
): Promise<AdminUserPasskey[]> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: params(userId) },
    method: "get",
    module: "admin/users",
    path: "/{id}/passkeys",
  });
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "a user's passkeys",
      `id=${userId}`,
    );
  }

  return (await response.json()).items;
};

export const fetchAdminUserSso = async (
  userId: number,
): Promise<SsoConnectionsApi> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: params(userId) },
    method: "get",
    module: "admin/users",
    path: "/{id}/sso",
  });
  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "a user's connected accounts",
      `id=${userId}`,
    );
  }

  return await response.json();
};

export const fetchAdminUserNotificationPreferences = async (
  userId: number,
): Promise<NotificationPreferenceTypeView[]> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: params(userId) },
    method: "get",
    module: "admin/users",
    path: "/{id}/notification-preferences",
  });
  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "a user's notification preferences",
      `id=${userId}`,
    );
  }

  return (await response.json()).types;
};

export const adminUserDevicesQueryOptions = (key: AdminUserAccountKey) =>
  queryOptions({
    queryFn: async () => await fetchAdminUserDevices(key.userId),
    queryKey: adminUserDevicesQueryKey(key),
    staleTime: RECORD_STALE_TIME,
  });

export const adminUserPasskeysQueryOptions = (key: AdminUserAccountKey) =>
  queryOptions({
    queryFn: async () => await fetchAdminUserPasskeys(key.userId),
    queryKey: adminUserPasskeysQueryKey(key),
    staleTime: RECORD_STALE_TIME,
  });

export const adminUserSsoQueryOptions = (key: AdminUserAccountKey) =>
  queryOptions({
    queryFn: async () => await fetchAdminUserSso(key.userId),
    queryKey: adminUserSsoQueryKey(key),
    staleTime: RECORD_STALE_TIME,
  });

export const adminUserNotificationsQueryOptions = (key: AdminUserAccountKey) =>
  queryOptions({
    queryFn: async () =>
      await fetchAdminUserNotificationPreferences(key.userId),
    queryKey: adminUserNotificationsQueryKey(key),
    staleTime: RECORD_STALE_TIME,
  });

export const countSignInMethods = ({
  passkeys,
  sso,
}: {
  passkeys: number;
  sso: SsoConnectionsApi | undefined;
}): number =>
  (sso?.signIn.hasPassword ? 1 : 0) +
  passkeys +
  (sso?.providers.filter(provider => provider.connection).length ?? 0);
