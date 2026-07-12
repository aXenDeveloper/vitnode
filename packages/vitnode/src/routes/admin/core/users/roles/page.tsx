import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";
import { ActionsRolesAdmin } from "@/views/admin/views/core/users/roles/actions/actions";

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
          <ActionsRolesAdmin />
        </HeaderContent>

        <React.Suspense fallback={<DataTableSkeleton columns={2} />}>
          <RolesAdminView {...props} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
