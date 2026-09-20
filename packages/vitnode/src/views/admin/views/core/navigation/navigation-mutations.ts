import type { z } from "zod";

import type {
  zodCreateNavigationSchema,
  zodReorderNavigationSchema,
  zodUpdateNavigationSchema,
} from "@/api/modules/admin/navigation/lib/schema";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";

export type AdminNavigationCreateInput = z.infer<
  typeof zodCreateNavigationSchema
>;

export type AdminNavigationUpdateInput = z.infer<
  typeof zodUpdateNavigationSchema
>;

export type AdminNavigationOrderInput = z.infer<
  typeof zodReorderNavigationSchema
>;

export const createAdminNavigation = async (
  body: AdminNavigationCreateInput,
): Promise<AdminMutationResult<{ id: number }>> =>
  await runAdminApiMutation({
    expected: 201,
    parse: async response => (await response.json()) as { id: number },
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body },
        method: "post",
        module: "admin/navigation",
        options: { credentials: "include" },
        path: "/create",
      }),
  });

export const updateAdminNavigation = async (
  id: number,
  body: AdminNavigationUpdateInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body, params: { id: String(id) } },
        method: "patch",
        module: "admin/navigation",
        options: { credentials: "include" },
        path: "/{id}",
      }),
  });

export const reorderAdminNavigation = async (
  body: AdminNavigationOrderInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body },
        method: "post",
        module: "admin/navigation",
        options: { credentials: "include" },
        path: "/reorder",
      }),
  });

export const deleteAdminNavigation = async (
  id: number,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { params: { id: String(id) } },
        method: "delete",
        module: "admin/navigation",
        options: { credentials: "include" },
        path: "/{id}",
      }),
  });
