import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { adminModule } from "@/api/modules/admin/admin.module";
import { CONFIG_PLUGIN } from "@/config";
import { fetcher } from "@/lib/fetcher";

import { redirect } from "../navigation";

export const getSessionAdminApi = async () => {
  const res = await fetcher(adminModule, {
    path: "/session",
    method: "get",
    module: "admin",
    options: {
      cache: "force-cache",
    },
  });

  if (res.status !== 200) {
    await redirect("/admin");

    return;
  }

  const data = await res.json();

  return data;
};

export const checkAdminPermissionApi = async ({
  plugin = CONFIG_PLUGIN.pluginId,
  module,
  permission,
}: Omit<PermissionsStaffArgs, "plugin"> & {
  plugin?: string;
}): Promise<boolean> => {
  const session = await getSessionAdminApi();
  if (!session) return false;

  return hasStaffPermission(session.permissions, {
    plugin,
    module,
    permission,
  });
};
