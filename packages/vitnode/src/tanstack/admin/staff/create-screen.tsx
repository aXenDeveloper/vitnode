import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { CreateStaffFormContent } from "@/views/admin/views/core/staff/create/create-staff-form-content";
import { staffEditHref } from "@/views/admin/views/core/staff/staff-model";
import { searchAdminUsersInBrowser } from "@/views/admin/views/core/users/list/users-query";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";

import type { AdminStaffCreateRouteData } from "./create-route";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_STAFF_CREATE_NAMESPACES } from "./create-route";
import { useStaffCreateCallback } from "./query";

export interface AdminStaffCreateRouteProps extends AdminStaffCreateRouteData {
  /** Where a created entry is opened. The host navigates; the package decides. */
  navigate: (href: string) => Promise<void> | void;
}

export const AdminStaffCreateRouteContent = ({
  backHref,
  backLabel,
  description,
  navigate,
  title,
  type,
}: AdminStaffCreateRouteProps) => {
  const onCreate = useStaffCreateCallback();

  return (
    <RouteMessages namespaces={ADMIN_STAFF_CREATE_NAMESPACES}>
      <div className="mx-auto max-w-4xl p-4">
        <PageTitle desc={description} h1={title}>
          <Link
            className={buttonVariants({ variant: "outline" })}
            to={backHref}
          >
            <ArrowLeftIcon />
            {backLabel}
          </Link>
        </PageTitle>

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
