import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { AdminStaffPermissionGate } from "@vitnode/core/components/staff-permission/provider";
import { AdminPermissionRequired } from "@vitnode/core/components/staff-permission/required";
import { DataTableSkeleton } from "@vitnode/core/components/table/data-table";
import { HeaderContent } from "@vitnode/core/components/ui/header-content";
import { CONFIG_PLUGIN } from "@vitnode/core/config";
import { ActionsRolesAdmin } from "@vitnode/core/views/admin/views/core/users/roles/actions/actions";

const RolesAdminView = dynamic(async () =>
  import("@vitnode/core/views/admin/views/core/users/roles/roles-admin-view").then(
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
          <AdminStaffPermissionGate
            module="roles"
            permission="can_create"
            plugin={CONFIG_PLUGIN.pluginId}
          >
            <ActionsRolesAdmin />
          </AdminStaffPermissionGate>
        </HeaderContent>

        <React.Suspense fallback={<DataTableSkeleton columns={2} toolbar />}>
          <AdminPermissionRequired module="roles" permission="can_view">
            <RolesAdminView {...props} />
          </AdminPermissionRequired>
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
