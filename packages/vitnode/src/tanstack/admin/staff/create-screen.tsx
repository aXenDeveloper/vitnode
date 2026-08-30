"use client";

import { ArrowLeftIcon } from "lucide-react";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { buttonVariants } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { CreateStaffFormContent } from "@/views/admin/views/core/staff/create/create-staff-form-content";
import { staffEditHref } from "@/views/admin/views/core/staff/staff-model";
import { searchAdminUsersInBrowser } from "@/views/admin/views/core/users/list/users-query";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";

import type { AdminStaffCreateRouteData } from "./create-route";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_STAFF_CREATE_NAMESPACES } from "./create-route";
import { useStaffCreateCallback } from "./query";

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
