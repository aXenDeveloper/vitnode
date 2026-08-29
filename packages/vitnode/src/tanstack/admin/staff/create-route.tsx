"use client";

import { ArrowLeftIcon } from "lucide-react";
import { createTranslator } from "use-intl";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { buttonVariants } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";
import { CreateStaffFormContent } from "@/views/admin/views/core/staff/create/create-staff-form-content";
import {
  STAFF_TYPE_SEGMENT,
  staffEditHref,
  staffListHref,
} from "@/views/admin/views/core/staff/staff-model";
import { searchAdminUsersInBrowser } from "@/views/admin/views/core/users/list/users-query";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { requireAdminPermission } from "../screen";
import { useStaffCreateCallback } from "./query";

/**
 * `/admin/core/staff/{admins,moderators}/create` - adding a role or a user to a
 * staff group.
 *
 * The permission is `staff_admins.can_create` or `staff_moderators.can_create`,
 * checked in the loader. The Next.js page checks the same tuple with
 * `checkAdminPermissionApi` and answers `notFound()`; this answers the router's
 * `notFound()`, which the AdminCP shell renders in place of the page - the same
 * outcome, one navigation earlier.
 *
 * The entry this creates grants **nothing**. Permissions are chosen on the edit
 * screen, so a successful create navigates there with the new id.
 */

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

export interface AdminStaffCreateRouteProps extends AdminStaffCreateRouteData {
  LinkComponent: AuthLinkComponent;
  /** Where a created entry is opened. The host navigates; the package decides. */
  navigate: (href: string) => Promise<void> | void;
}

export const AdminStaffCreateRouteContent = ({
  backHref,
  backLabel,
  description,
  LinkComponent,
  navigate,
  title,
  type,
}: AdminStaffCreateRouteProps) => {
  const onCreate = useStaffCreateCallback();

  return (
    <RouteMessages namespaces={ADMIN_STAFF_CREATE_NAMESPACES}>
      <div className="mx-auto max-w-4xl p-4">
        <HeaderContent desc={description} h1={title}>
          <LinkComponent
            className={buttonVariants({ variant: "outline" })}
            href={backHref}
          >
            <ArrowLeftIcon />
            {backLabel}
          </LinkComponent>
        </HeaderContent>

        <CreateStaffFormContent
          onCreate={onCreate}
          onCreated={id => {
            void navigate(staffEditHref(type, id));
          }}
          searchRoles={searchAdminRolesInBrowser}
          searchUsers={searchAdminUsersInBrowser}
          type={type}
        />
      </div>
    </RouteMessages>
  );
};
