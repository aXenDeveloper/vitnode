import type { UserImageKind } from "@/lib/user-images";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";
import { readApiErrorMessage } from "@/lib/read-api-error";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";

export interface AdminUserUpdateInput {
  email?: string;
  name?: string;
  nameCode?: string;
  roleId?: number;
  secondaryRoleIds?: number[];
}

export interface AdminUserUpdated {
  email: string;
  id: number;
  name: string;
  nameCode: string;
}

export const updateAdminUser = async (
  id: number,
  body: AdminUserUpdateInput,
): Promise<AdminMutationResult<AdminUserUpdated>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response => (await response.json()) as AdminUserUpdated,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body, params: { id: String(id) } },
        method: "patch",
        module: "admin/users",
        options: { credentials: "include" },
        path: "/{id}",
      }),
  });

export const updateAdminUserRoles = async (
  id: number,
  body: { roleId: number; secondaryRoleIds: number[] },
): Promise<AdminMutationResult<AdminUserUpdated>> =>
  await updateAdminUser(id, body);

export interface AdminUserVerified {
  emailVerified: boolean;
  name: string;
}

/** Mark a user's email address verified, from the row action or the detail page. */
export const verifyAdminUserEmail = async (
  id: number,
): Promise<AdminMutationResult<AdminUserVerified>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response => (await response.json()) as AdminUserVerified,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { params: { id: String(id) } },
        method: "post",
        module: "admin/users",
        options: { credentials: "include" },
        path: "/{id}/verify-email",
      }),
  });

export interface AdminUserCreateInput {
  email: string;
  name: string;
  password: string;
}

export interface AdminUserCreated {
  email: string;
  id: number;
  name: string;
}

export const createAdminUser = async (
  body: AdminUserCreateInput,
): Promise<AdminMutationResult<AdminUserCreated>> =>
  await runAdminApiMutation({
    expected: 201,
    parse: async response => (await response.json()) as AdminUserCreated,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body },
        method: "post",
        module: "admin/users",
        options: { credentials: "include" },
        path: "/create",
      }),
  });

export const adminUserCreateConflictField = (
  message: string,
): "email" | "name" | null => {
  const value = message.trim().toLowerCase();
  if (value.includes("email already exists")) return "email";
  if (value.includes("name already exists")) return "name";

  return null;
};

export class AdminUserImageError extends Error {
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminUserImageError";
    this.status = status;
  }

  readonly status: number;
}

const imageRejectionOf = async (
  response: Response,
  fallback: string,
): Promise<AdminUserImageError> =>
  new AdminUserImageError(
    response.status,
    (await readApiErrorMessage(response)) ?? fallback,
  );

export const uploadAdminUserImage = async (
  id: number,
  kind: UserImageKind,
  file: File,
): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id: String(id), kind } },
    formData,
    method: "post",
    module: "admin/users",
    options: { credentials: "include" },
    path: "/{id}/images/{kind}",
  });

  if (!response.ok) {
    throw await imageRejectionOf(
      response,
      `The upload answered ${response.status}.`,
    );
  }

  return await response.json();
};

export const removeAdminUserImage = async (
  id: number,
  kind: UserImageKind,
): Promise<void> => {
  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id: String(id), kind } },
    method: "delete",
    module: "admin/users",
    options: { credentials: "include" },
    path: "/{id}/images/{kind}",
  });

  if (!response.ok) {
    throw await imageRejectionOf(
      response,
      `The removal answered ${response.status}.`,
    );
  }
};
