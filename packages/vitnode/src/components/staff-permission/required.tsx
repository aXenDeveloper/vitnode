import { notFound } from "next/navigation";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";

/**
 * Renders `children` for an admin holding the given permission, and 404s for
 * one who doesn't.
 *
 * A component rather than an `await` at the top of the page body on purpose.
 * The AdminCP layout already wraps `{children}` in a `<Suspense>`, but that
 * boundary belongs to the layout and spans the whole segment, which is too high
 * to make a navigation into the page instant - so a page awaiting its own
 * permission gate kept itself out of the static shell. Rendered inside the
 * page's own boundary, the read streams and the page header prerenders.
 */
export const AdminPermissionRequired = async ({
  children,
  module,
  permission,
  plugin,
}: Omit<PermissionsStaffArgs, "plugin"> & {
  children: React.ReactNode;
  plugin?: string;
}) => {
  const allowed = await checkAdminPermissionApi({
    module,
    permission,
    plugin,
  });

  if (!allowed) {
    notFound();
  }

  return children;
};
