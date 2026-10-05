import type { SsoProfileField } from "@/lib/sso-profile";
import type { NotificationPreferenceTypeView } from "@/views/notifications/notifications-query";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";

import type { AdminUserPasskey } from "./user-account-query";

const OPTIONS = { credentials: "include" } as const;

const ok = () => true as const;

export const setAdminUserPassword = async (
  id: number,
  password: string,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body: { password }, params: { id: String(id) } },
        method: "put",
        module: "admin/users",
        options: OPTIONS,
        path: "/{id}/password",
      }),
  });

export const revokeAdminUserDevice = async (
  id: number,
  publicId: string,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: {
          params: { id: String(id), publicId: encodeURIComponent(publicId) },
        },
        method: "delete",
        module: "admin/users",
        options: OPTIONS,
        path: "/{id}/devices/{publicId}",
      }),
  });

export const revokeAdminUserDevices = async (
  id: number,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { params: { id: String(id) } },
        method: "delete",
        module: "admin/users",
        options: OPTIONS,
        path: "/{id}/devices",
      }),
  });

export const renameAdminUserPasskey = async (
  id: number,
  passkeyId: number,
  name: string,
): Promise<AdminMutationResult<AdminUserPasskey>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response => (await response.json()) as AdminUserPasskey,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: {
          body: { name },
          params: { id: String(id), passkeyId: String(passkeyId) },
        },
        method: "patch",
        module: "admin/users",
        options: OPTIONS,
        path: "/{id}/passkeys/{passkeyId}",
      }),
  });

export const deleteAdminUserPasskey = async (
  id: number,
  passkeyId: number,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { params: { id: String(id), passkeyId: String(passkeyId) } },
        method: "delete",
        module: "admin/users",
        options: OPTIONS,
        path: "/{id}/passkeys/{passkeyId}",
      }),
  });

export const disconnectAdminUserSso = async (
  id: number,
  providerId: string,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: {
          params: {
            id: String(id),
            providerId: encodeURIComponent(providerId),
          },
        },
        method: "delete",
        module: "admin/users",
        options: OPTIONS,
        path: "/{id}/sso/{providerId}",
      }),
  });

export interface AdminUserSsoPreferencesInput {
  sources: Partial<Record<SsoProfileField, null | string>>;
  sync: Record<string, boolean>;
}

export const updateAdminUserSsoPreferences = async (
  id: number,
  body: AdminUserSsoPreferencesInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body, params: { id: String(id) } },
        method: "put",
        module: "admin/users",
        options: OPTIONS,
        path: "/{id}/sso/preferences",
      }),
  });

export type AdminUserNotificationPatch = Partial<
  NotificationPreferenceTypeView["value"]
>;

export const updateAdminUserNotificationPreferences = async (
  id: number,
  types: Record<string, AdminUserNotificationPatch>,
): Promise<AdminMutationResult<NotificationPreferenceTypeView[]>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response =>
      ((await response.json()) as { types: NotificationPreferenceTypeView[] })
        .types,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body: { types }, params: { id: String(id) } },
        method: "put",
        module: "admin/users",
        options: OPTIONS,
        path: "/{id}/notification-preferences",
      }),
  });
