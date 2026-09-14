import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { PluginRouteTranslator } from "@/routing";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminStaffParams } from "@/views/admin/views/core/staff/staff-query";

import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";
import { STAFF_TYPE_SEGMENT } from "@/views/admin/views/core/staff/staff-model";

import type { AdminScreenContext } from "../screen";

import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminStaffQuery } from "./query";

export const ADMIN_STAFF_NAMESPACES = ["admin.staff", "core.global"] as const;

export interface AdminStaffRouteData {
  adminUserId: AdminIdentity;
  createLabel: string;
  description: string;
  params: AdminStaffParams;
  title: string;
  type: PermissionStaffType;
}

export const loadAdminStaffRoute = async ({
  adminAccess,
  params,
  queryClient,
  t,
  type,
}: AdminScreenContext & {
  params: AdminStaffParams;
  t: PluginRouteTranslator;
  type: PermissionStaffType;
}): Promise<AdminStaffRouteData> => {
  requireAdminPermission(adminAccess, adminStaffPermissions(type).view);

  const adminUserId = adminIdentityOf(adminAccess);

  await queryClient.query({
    ...adminStaffQuery({ adminUserId, params, type }),
    staleTime: "static",
  });

  // The kind of staff member is the URL, not a parameter, so it picks the
  // branch of the message tree rather than being interpolated into a string.
  const staff = `admin.staff.${STAFF_TYPE_SEGMENT[type]}`;

  return {
    adminUserId,
    createLabel: t(`${staff}.create`),
    description: t(`${staff}.desc`),
    params,
    title: t(`${staff}.title`),
    type,
  };
};
