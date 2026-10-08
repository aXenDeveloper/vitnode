import type { z } from "zod";

import type {
  zodAiActionSettingsInput,
  zodAiSettings,
} from "@/api/modules/admin/ai/schemas";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";

export type AdminAiSettingsInput = z.infer<typeof zodAiSettings>;
export type AdminAiActionInput = z.infer<typeof zodAiActionSettingsInput>;

export interface AdminAiRoleAccessInput {
  grants: {
    dailyLimit: null | number;
    granted: boolean | null;
    permission: string;
  }[];
  monthlyPoints: null | string;
  roleId: number;
  unlimited: boolean;
}

export interface AdminAiUserOverrideInput {
  blocked: boolean;
  monthlyPoints: null | string;
  unlimited: boolean;
  userId: number;
}

const ok = () => true as const;

export const updateAdminAiSettings = async (
  body: AdminAiSettingsInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body },
        method: "put",
        module: "admin/ai",
        options: { credentials: "include" },
        path: "/settings",
      }),
  });

export const updateAdminAiAction = async (
  body: AdminAiActionInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body },
        method: "put",
        module: "admin/ai",
        options: { credentials: "include" },
        path: "/actions",
      }),
  });

export const updateAdminAiRoleAccess = async (
  body: AdminAiRoleAccessInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body },
        method: "put",
        module: "admin/ai",
        options: { credentials: "include" },
        path: "/access/roles",
      }),
  });

export const updateAdminAiUserOverride = async (
  body: AdminAiUserOverrideInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body },
        method: "put",
        module: "admin/ai",
        options: { credentials: "include" },
        path: "/access/users",
      }),
  });

export const deleteAdminAiUserOverride = async (
  userId: number,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { query: { userId } },
        method: "delete",
        module: "admin/ai",
        options: { credentials: "include" },
        path: "/access/users",
      }),
  });
