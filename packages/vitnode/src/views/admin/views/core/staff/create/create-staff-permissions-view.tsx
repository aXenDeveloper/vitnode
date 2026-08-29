import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { Link } from "@/lib/navigation";
import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";

import { STAFF_TYPE_SEGMENT, staffListHref } from "../staff-model";
import { CreateStaffPermissionsForm } from "./create-staff-form-next";

/**
 * Adding a role or a user to a staff group, as this application's Server
 * Component.
 *
 * The permission check is the same tuple the TanStack loader passes to
 * `requireAdminPermission`, and both end in a not-found rather than a redirect:
 * an administrator who may not create staff should not be told that the page
 * exists.
 */
export const CreateStaffPermissionsView = async ({
  type,
}: {
  type: PermissionStaffType;
}) => {
  const permissions = adminStaffPermissions(type);
  const [t, canCreate] = await Promise.all([
    getTranslations("admin.staff.create"),
    checkAdminPermissionApi(permissions.create),
  ]);

  if (!canCreate) {
    notFound();
  }

  return (
    <>
      <HeaderContent desc={t("desc")} h1={t(STAFF_TYPE_SEGMENT[type])}>
        <Button
          nativeButton={false}
          render={<Link href={staffListHref(type)} />}
          variant="outline"
        >
          <ArrowLeftIcon />
          {t("back")}
        </Button>
      </HeaderContent>

      <CreateStaffPermissionsForm type={type} />
    </>
  );
};
