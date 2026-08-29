"use server";

import { revalidatePath } from "next/cache";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type {
  AdminUserUpdated,
  AdminUserUpdateInput,
} from "@/views/admin/views/core/users/users-mutations";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

/**
 * Updating a user, as this application's Server Action.
 *
 * One action for every column the detail screen edits - the name, the email, the
 * name code and the two role fields - because `PATCH /admin/users/{id}` takes
 * them all and decides which ones a body touches. The shape matches
 * `updateAdminUser`, so the shared editors can be handed either.
 *
 * The `409` status is what tells a name-code dialog to put its message on the
 * field rather than in a toast, so it is returned rather than thrown.
 */
export const updateUserAction = async (
  id: number,
  body: AdminUserUpdateInput,
): Promise<AdminMutationResult<AdminUserUpdated>> => {
  const res = await fetcher(adminModule, {
    args: { body, params: { id: String(id) } },
    method: "patch",
    module: "admin/users",
    path: "/{id}",
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  const data = await res.json();
  revalidatePath("/[locale]/admin", "layout");

  return { data };
};
