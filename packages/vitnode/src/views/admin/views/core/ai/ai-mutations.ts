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

import type { AdminAiPricing } from "./ai-query";

export type AdminAiSettingsInput = z.infer<typeof zodAiSettings>;
export type AdminAiActionInput = z.infer<typeof zodAiActionSettingsInput>;

export interface AdminAiRoleAccessInput {
  grants: {
    dailyLimit: null | number;
    /** `null` removes the row, so the action's default applies. */
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

export interface AdminAiSyncPricingResult {
  unchanged: string[];
  unpriced: string[];
  updated: string[];
}

export interface AdminAiTestResult {
  output: unknown;
  runId: number;
  usage: { chargedPoints: string; costKnown: boolean; modelId: string };
}

export interface AdminAiAltSweepResult {
  enqueued: number;
  scanned: number;
}

const ok = () => true as const;

export const sweepAdminAiAlt = async (): Promise<
  AdminMutationResult<AdminAiAltSweepResult>
> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response => (await response.json()) as AdminAiAltSweepResult,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/ai",
        options: { credentials: "include" },
        path: "/alt/sweep",
      }),
  });

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

export const updateAdminAiPricing = async (body: {
  modelId: string;
  pricing: AdminAiPricing;
}): Promise<AdminMutationResult<true>> =>
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
        path: "/models/pricing",
      }),
  });

export const deleteAdminAiPricing = async (
  modelId: string,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { query: { modelId } },
        method: "delete",
        module: "admin/ai",
        options: { credentials: "include" },
        path: "/models/pricing",
      }),
  });

export const syncAdminAiPricing = async (): Promise<
  AdminMutationResult<AdminAiSyncPricingResult>
> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response =>
      (await response.json()) as AdminAiSyncPricingResult,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/ai",
        options: { credentials: "include" },
        path: "/models/sync-pricing",
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

export const testAdminAiAction = async (body: {
  input: unknown;
  key: string;
}): Promise<AdminMutationResult<AdminAiTestResult>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response => (await response.json()) as AdminAiTestResult,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body },
        method: "post",
        module: "admin/ai",
        options: { credentials: "include" },
        path: "/actions/test",
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
