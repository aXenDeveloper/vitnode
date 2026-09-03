import { createTranslator } from "use-intl";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminStaffParams } from "@/views/admin/views/core/staff/staff-query";

import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";
import { STAFF_TYPE_SEGMENT } from "@/views/admin/views/core/staff/staff-model";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
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
  locale,
  params,
  queryClient,
  type,
}: AdminScreenContext & {
  params: AdminStaffParams;
  type: PermissionStaffType;
}): Promise<AdminStaffRouteData> => {
  requireAdminPermission(adminAccess, adminStaffPermissions(type).view);

  const adminUserId = adminIdentityOf(adminAccess);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_STAFF_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...adminStaffQuery({ adminUserId, params, type }),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: {
        staff: {
          admins: { create: string; desc: string; title: string };
          moderators: { create: string; desc: string; title: string };
        };
      };
    },
    namespace:
      `admin.staff.${STAFF_TYPE_SEGMENT[type]}` as "admin.staff.admins",
  });

  return {
    adminUserId,
    createLabel: t("create"),
    description: t("desc"),
    params,
    title: t("title"),
    type,
  };
};
