"use server";

import { revalidatePath } from "next/cache";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type {
  AdminUserCreated,
  AdminUserCreateInput,
} from "@/views/admin/views/core/users/users-mutations";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

/**
 * Creating a user, as this application's Server Action.
 *
 * The same request `createAdminUser` makes from a browser, and the same result
 * shape - so the shared dialog can be handed either. What only exists here is
 * `revalidatePath`; the TanStack AdminCP invalidates a query key instead.
 *
 * The `409` body is carried through rather than swallowed: it says whether the
 * email or the name collided, and `adminUserCreateConflictField` is what turns
 * that sentence into the field the message belongs beside.
 */
export const createUserAction = async (
  body: AdminUserCreateInput,
): Promise<AdminMutationResult<AdminUserCreated>> => {
  const res = await fetcher(adminModule, {
    args: { body },
    method: "post",
    module: "admin/users",
    path: "/create",
  });

  if (res.status !== 201) {
    return { error: { message: await res.text(), status: res.status } };
  }

  const data = await res.json();
  revalidatePath("/[locale]/admin", "layout");

  return { data };
};
