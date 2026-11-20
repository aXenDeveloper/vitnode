import { manifest } from "@vitnode/api/manifest";

import { fetcherClient } from "@/lib/fetcher-client";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";

/** What the AdminCP sends to create or edit a reaction. */
export interface AdminReactionInput {
  allRoles: boolean;
  code: string;
  enabled: boolean;
  fileId: null | number;
  icon: null | string;
  kind: "emoji" | "icon" | "image";
  points: number;
  posterFileId: null | number;
  roles: { dailyLimit: null | number; roleId: number }[];
  title: { languageCode: string; value: string }[];
}

/** A role's reaction settings, as the role form saves them. */
export interface AdminRoleReactionsInput {
  allowReact: boolean;
  allowReactOwnContent: boolean;
  maxReactionsPerItem: null | number;
  reactionsPerDay: null | number;
}

const options = { credentials: "include" } as const;

export const createAdminReaction = async (
  body: AdminReactionInput,
): Promise<AdminMutationResult<{ id: number }>> =>
  await runAdminApiMutation({
    expected: 201,
    parse: async response => (await response.json()) as { id: number },
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body },
        method: "post",
        module: "admin/reactions",
        options,
        path: "/create",
      }),
  });

export const updateAdminReaction = async (
  id: number,
  body: AdminReactionInput,
): Promise<AdminMutationResult<{ id: number; recounting: boolean }>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response =>
      (await response.json()) as { id: number; recounting: boolean },
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body, params: { id } },
        method: "patch",
        module: "admin/reactions",
        options,
        path: "/{id}",
      }),
  });

export const deleteAdminReaction = async (
  id: number,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { params: { id } },
        method: "delete",
        module: "admin/reactions",
        options,
        path: "/{id}",
      }),
  });

export const fetchAdminReactionImpact = async (
  id: number,
): Promise<AdminMutationResult<{ reactions: number; reputation: number }>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response =>
      (await response.json()) as { reactions: number; reputation: number },
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { params: { id } },
        method: "get",
        module: "admin/reactions",
        options,
        path: "/{id}/impact",
      }),
  });

export const reorderAdminReactions = async (
  ids: number[],
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { ids } },
        method: "put",
        module: "admin/reactions",
        options,
        path: "/reorder",
      }),
  });

export const recountAdminReputation = async (): Promise<
  AdminMutationResult<true>
> =>
  await runAdminApiMutation({
    expected: 202,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        method: "post",
        module: "admin/reactions",
        options,
        path: "/recount",
      }),
  });

/** Uploads one reaction image; the API checks and scales it. */
export const uploadAdminReactionImage = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  return await runAdminApiMutation({
    expected: 200,
    parse: async response =>
      (await response.json()) as {
        fileId: number;
        image: {
          animated: boolean;
          height: null | number;
          posterUrl: null | string;
          url: string;
          width: null | number;
        };
        posterFileId: null | number;
      },
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        formData,
        method: "post",
        module: "admin/reactions",
        options,
        path: "/upload",
      }),
  });
};

export const updateAdminRoleReactions = async (
  roleId: number,
  body: AdminRoleReactionsInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body, params: { roleId } },
        method: "put",
        module: "admin/reactions",
        options,
        path: "/roles/{roleId}",
      }),
  });
