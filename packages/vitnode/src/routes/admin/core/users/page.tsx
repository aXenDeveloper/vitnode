import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { AdminPermissionRequired } from "@/components/staff-permission/required";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";
import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { CreateUserAdmin } from "@/views/admin/views/core/users/list/create-user-next";

const UsersAdminView = dynamic(async () =>
  import("@/views/admin/views/core/users/users-admin-view").then(module => ({
    default: module.UsersAdminView,
  })),
);

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("admin.global.nav.users");

  return {
    title: t("list"),
  };
};

export default async function Page(
  props: React.ComponentProps<typeof UsersAdminView>,
) {
  const [t, tNav] = await Promise.all([
    getTranslations("admin.user.list"),
    getTranslations("admin.global.nav.users"),
  ]);

  return (
    <I18nProvider namespaces="admin.user">
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={tNav("list")}>
          <AdminStaffPermissionGate {...ADMIN_USER_PERMISSIONS.create}>
            <CreateUserAdmin />
          </AdminStaffPermissionGate>
        </HeaderContent>

        <React.Suspense fallback={<DataTableSkeleton columns={2} toolbar />}>
          <AdminPermissionRequired {...ADMIN_USER_PERMISSIONS.view}>
            <UsersAdminView {...props} />
          </AdminPermissionRequired>
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
