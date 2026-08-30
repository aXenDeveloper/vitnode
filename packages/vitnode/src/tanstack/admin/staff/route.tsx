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

/**
 * `/admin/core/staff/admins` and `/admin/core/staff/moderators` - one screen,
 * two routes.
 *
 * The two lists differ in exactly one value: the staff type, which decides the
 * API endpoint, the permission module and the strings. Everything else - the
 * columns, the padlock, the delete, the pager - is identical, which is why
 * `type` is a parameter rather than a second copy of this file.
 *
 * ## The permission model is the Next.js page's, unchanged
 *
 *     staff_admins.can_view      the administrators list, and its API route
 *     staff_admins.can_create    the "add" button
 *     staff_admins.can_edit      the row's pencil, and the edit screen
 *     staff_admins.can_delete    the row's bin
 *
 * ...and `staff_moderators.*` for the other list. `staffPermissionModuleFor` is
 * the mapping, and it is the frontend's copy of `staffPermissionModuleByType`.
 */

/**
 * What these screens render strings from.
 *
 * `admin.staff` is the heading, the tabs, the columns and the delete dialog;
 * `core.global` is the table's furniture, the confirm dialog's buttons and the
 * error toasts. The same set `<I18nProvider namespaces="admin.staff">` provides
 * in the Next.js pages.
 */
export const ADMIN_STAFF_NAMESPACES = ["admin.staff", "core.global"] as const;

export interface AdminStaffRouteData {
  adminUserId: AdminIdentity;
  createLabel: string;
  description: string;
  params: AdminStaffParams;
  title: string;
  type: PermissionStaffType;
}

/**
 * Both reads, in parallel, after the permission is checked.
 *
 * The permission is `staff_admins.can_view` or `staff_moderators.can_view`
 * depending on the list, which is what `<AdminPermissionRequired>` states in the
 * Next.js page and what `listAdminsStaffAdminRoute` /
 * `listModeratorsStaffAdminRoute` declare as their `adminStaffPermission`.
 */
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
    queryClient.ensureQueryData(adminStaffQuery({ adminUserId, params, type })),
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
