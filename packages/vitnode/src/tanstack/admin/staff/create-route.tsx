import type { PluginRouteTranslator } from "@/routing";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";
import {
  STAFF_TYPE_SEGMENT,
  staffListHref,
} from "@/views/admin/views/core/staff/staff-model";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";

/** Only the two namespaces the screen renders from - no catalog is read here. */
export const ADMIN_STAFF_CREATE_NAMESPACES = [
  "admin.staff",
  "core.global",
] as const;

export interface AdminStaffCreateRouteData {
  backHref: string;
  backLabel: string;
  description: string;
  title: string;
  type: PermissionStaffType;
}

export const loadAdminStaffCreateRoute = async ({
  adminAccess,
  t,
  type,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
  type: PermissionStaffType;
}): Promise<AdminStaffCreateRouteData> => {
  requireAdminPermission(adminAccess, adminStaffPermissions(type).create);

  return await Promise.resolve({
    backHref: staffListHref(type),
    backLabel: t("admin.staff.create.back"),
    description: t("admin.staff.create.desc"),
    title: t(`admin.staff.create.${STAFF_TYPE_SEGMENT[type]}`),
    type,
  });
};
