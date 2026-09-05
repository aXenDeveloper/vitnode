import { createTranslator } from "use-intl";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";
import {
  STAFF_TYPE_SEGMENT,
  staffListHref,
} from "@/views/admin/views/core/staff/staff-model";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
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
  locale,
  queryClient,
  type,
}: AdminScreenContext & {
  type: PermissionStaffType;
}): Promise<AdminStaffCreateRouteData> => {
  requireAdminPermission(adminAccess, adminStaffPermissions(type).create);

  const intl = await queryClient.ensureQueryData(
    intlQueryOptions({ locale, namespaces: ADMIN_STAFF_CREATE_NAMESPACES }),
  );

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: {
        staff: {
          create: {
            admins: string;
            back: string;
            desc: string;
            moderators: string;
          };
        };
      };
    },
    namespace: "admin.staff.create",
  });

  return {
    backHref: staffListHref(type),
    backLabel: t("back"),
    description: t("desc"),
    title: t(STAFF_TYPE_SEGMENT[type]),
    type,
  };
};
