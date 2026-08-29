import { notFound } from "next/navigation";

import { EMPTY_STAFF_PERMISSION_SET } from "@/api/lib/staff-permission";
import { adminModule } from "@/api/modules/admin/admin.module";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";
import { fetcher } from "@/lib/fetcher";

import { UserDetailNext } from "../detail/user-detail-next";
import {
  adminUserRequest,
  canEditAdminUser,
  normalizeAdminUserId,
} from "../detail/user-query";

/**
 * The AdminCP user page, as this application's Server Component.
 *
 * Three things happen here and nothing else does: the id is normalised, the user
 * is read with the request's own cookies, and `canEdit` is decided. The page
 * itself - the profile card, the in-place editors, the roles dialog and the
 * timeline tab - is `UserDetailContent`, which the TanStack AdminCP renders too.
 *
 * `canEditAdminUser` is the same predicate on both sides, so `users.can_edit`
 * plus `users.can_edit_admin` for an administrator target is one rule rather
 * than two that happen to agree. The API enforces it again on every write
 * (`assertCanEditAdminTarget`), which is what makes this a display decision.
 */
export const ShowUserAdminView = async ({ id: raw }: { id: string }) => {
  const id = normalizeAdminUserId(raw);
  if (id === null) {
    notFound();
  }

  const res = await fetcher(adminModule, adminUserRequest(id));
  if (res.status !== 200) {
    notFound();
  }

  const [user, session] = await Promise.all([res.json(), getSessionAdminApi()]);

  return (
    <UserDetailNext
      canEdit={canEditAdminUser(
        session?.permissions ?? EMPTY_STAFF_PERMISSION_SET,
        { isAdmin: user.isAdmin },
      )}
      user={user}
    />
  );
};
