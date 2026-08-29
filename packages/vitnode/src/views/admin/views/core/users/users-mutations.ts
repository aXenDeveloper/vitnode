/**
 * Everything the AdminCP writes about a user, as browser requests.
 *
 * One function per write, each returning the status rather than throwing it -
 * the shape and the reasoning are `shared/admin-mutation.ts`, which every
 * AdminCP mutation module in this stage shares.
 */

import { fetcherClient } from "@/lib/fetcher-client";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";

import { adminModuleRef } from "./list/users-query";

/**
 * Every column `PATCH /admin/users/{id}` accepts, all optional.
 *
 * One body type rather than one per caller: `zodUpdateUserAdminSchema` is a
 * `.partial()` with an "at least one field" refinement, so what makes a request
 * valid is that *something* is set, not which screen set it.
 */
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

/**
 * Rename a user, change their email, or change their name code.
 *
 * One request per edit rather than a form-wide save, because that is what the
 * screen does: each field has its own pencil, its own optimistic close and its
 * own error. `zodUpdateUserAdminSchema` is `.partial()` with a "at least one
 * field" refinement, so sending one key is the intended shape.
 */
export const updateAdminUser = async (
  id: number,
  body: AdminUserUpdateInput,
): Promise<AdminMutationResult<AdminUserUpdated>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response => (await response.json()) as AdminUserUpdated,
    request: async () =>
      await fetcherClient(adminModuleRef, {
        args: { body, params: { id: String(id) } },
        method: "patch",
        module: "admin/users",
        options: { credentials: "include" },
        path: "/{id}",
      }),
  });

/**
 * Replace a user's primary role and their whole secondary set.
 *
 * The same `PATCH` as the field edits - the API decides which columns a body
 * touches - and deliberately a *replacement* rather than a diff: the dialog
 * holds the complete intended set, and sending "add these, remove those" would
 * make two administrators editing at once produce a set neither of them chose.
 */
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
      await fetcherClient(adminModuleRef, {
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

/**
 * Create a user from the AdminCP.
 *
 * `201`, not `200`. The `409` the API answers for a taken email or name is
 * returned rather than thrown so the dialog can put the message on the right
 * field - which of the two it was comes back in the body, and is decoded by
 * {@link adminUserCreateConflictField}.
 */
export const createAdminUser = async (
  body: AdminUserCreateInput,
): Promise<AdminMutationResult<AdminUserCreated>> =>
  await runAdminApiMutation({
    expected: 201,
    parse: async response => (await response.json()) as AdminUserCreated,
    request: async () =>
      await fetcherClient(adminModuleRef, {
        args: { body },
        method: "post",
        module: "admin/users",
        options: { credentials: "include" },
        path: "/create",
      }),
  });

/**
 * Which field a create conflict was about.
 *
 * The API answers `409` with a plain-text message rather than a code, so the
 * mapping is a string comparison and has to live somewhere both frontends can
 * see it - the Next.js dialog matches the same two sentences today.
 *
 * Anything else is `null`, which the caller shows as a generic error rather than
 * attaching to a field that may not be the cause.
 */
export const adminUserCreateConflictField = (
  message: string,
): "email" | "name" | null => {
  const value = message.trim().toLowerCase();
  if (value.includes("email already exists")) return "email";
  if (value.includes("name already exists")) return "name";

  return null;
};
