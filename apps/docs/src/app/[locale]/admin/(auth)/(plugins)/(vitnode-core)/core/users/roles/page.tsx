import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { DataTableSkeleton } from "@vitnode/core/components/table/data-table";
import { HeaderContent } from "@vitnode/core/components/ui/header-content";
import { checkAdminPermissionApi } from "@vitnode/core/lib/api/get-session-admin-api";
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
  const [t, tNav, canView, canCreate] = await Promise.all([
    getTranslations("admin.role.list"),
    getTranslations("admin.global.nav.users"),
    checkAdminPermissionApi({ module: "roles", permission: "can_view" }),
    checkAdminPermissionApi({ module: "roles", permission: "can_create" }),
  ]);

  if (!canView) {
    notFound();
  }

  return (
    <I18nProvider namespaces="admin.role">
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={tNav("roles")}>
          {canCreate && <ActionsRolesAdmin />}
        </HeaderContent>

        <React.Suspense fallback={<DataTableSkeleton columns={2} />}>
          <RolesAdminView {...props} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
