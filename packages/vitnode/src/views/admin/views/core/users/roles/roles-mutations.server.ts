"use server";

import { revalidatePath } from "next/cache";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

import type { AdminRoleInput } from "./roles-mutations";

import { deleteAdminRoleArgs } from "./roles-mutations";

/**
 * The three role writes, as this application's Server Actions.
 *
 * The same three requests `roles-mutations.ts` makes from a browser - the
 * *arguments* are shared, `deleteAdminRoleArgs` included, because "a role with
 * members must name a destination" is a rule about the request rather than about
 * a framework. What only exists here is `revalidatePath`; the TanStack AdminCP
 * invalidates three query families instead, one of which is the admin session.
 */

export const createRoleAction = async (
  body: AdminRoleInput,
): Promise<AdminMutationResult<{ id: number }>> => {
  const res = await fetcher(adminModule, {
    args: { body },
    method: "post",
    module: "admin/roles",
    path: "/create",
  });

  if (res.status !== 201) {
    return { error: { message: await res.text(), status: res.status } };
  }

  const data = await res.json();
  revalidatePath("/[locale]/admin", "layout");

  return { data };
};

export const updateRoleAction = async (
  id: number,
  body: AdminRoleInput,
): Promise<AdminMutationResult<true>> => {
  const res = await fetcher(adminModule, {
    args: { body, params: { id: String(id) } },
    method: "patch",
    module: "admin/roles",
    path: "/{id}",
  });

  if (res.status !== 200) {
    return { error: { message: await res.text(), status: res.status } };
  }

  revalidatePath("/[locale]/admin", "layout");

  return { data: true };
};

export const deleteRoleAction = async (args: {
  id: number;
  moveToRoleId?: number;
}): Promise<AdminMutationResult<true>> => {
  const res = await fetcher(adminModule, {
    args: deleteAdminRoleArgs(args),
    method: "delete",
    module: "admin/roles",
    path: "/{id}",
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  revalidatePath("/[locale]/admin", "layout");

  return { data: true };
};
