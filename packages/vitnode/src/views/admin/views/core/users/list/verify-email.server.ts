"use server";

import { revalidatePath } from "next/cache";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

/**
 * Marking a user's email verified, as this application's Server Action.
 *
 * The request is the same one `verifyAdminUserEmail` makes from a browser; what
 * only exists here is the last line. `revalidatePath` is Next.js's answer to
 * "the list on screen is now wrong", and the TanStack AdminCP answers it with a
 * query invalidation instead - which is why the *write* is shared and the
 * refresh is not.
 *
 * The shape matches `VerifyAdminUserEmail`, so one table component can be handed
 * either.
 */
export const verifyEmailAction = async (
  id: number,
): Promise<{ error?: string; name?: string }> => {
  const res = await fetcher(adminModule, {
    args: { params: { id: String(id) } },
    method: "post",
    module: "admin/users",
    path: "/{id}/verify-email",
  });

  if (res.status !== 200) {
    return { error: await res.text() };
  }

  const data = await res.json();
  revalidatePath("/[locale]/admin", "layout");

  return { name: data.name };
};
