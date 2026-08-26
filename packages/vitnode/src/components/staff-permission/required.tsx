import { notFound } from "next/navigation";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";

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
