import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { AdminPermissionRequired } from "@/components/staff-permission/required";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";
import { ADMIN_ROLE_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { CreateRoleAdmin } from "@/views/admin/views/core/users/roles/roles-table-next";

const RolesAdminView = dynamic(async () =>
  import("@/views/admin/views/core/users/roles/roles-admin-view").then(
    module => ({
      default: module.RolesAdminView,
    }),
  ),
);

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("admin.global.nav.users");

  return {
    title: t("roles"),
  };
};

export default async function Page(
  props: React.ComponentProps<typeof RolesAdminView>,
) {
  const [t, tNav] = await Promise.all([
    getTranslations("admin.role.list"),
    getTranslations("admin.global.nav.users"),
  ]);

  return (
    <I18nProvider namespaces="admin.role">
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={tNav("roles")}>
          <AdminStaffPermissionGate {...ADMIN_ROLE_PERMISSIONS.create}>
            <CreateRoleAdmin />
          </AdminStaffPermissionGate>
        </HeaderContent>

        <React.Suspense fallback={<DataTableSkeleton columns={2} toolbar />}>
          <AdminPermissionRequired {...ADMIN_ROLE_PERMISSIONS.view}>
            <RolesAdminView {...props} />
          </AdminPermissionRequired>
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
