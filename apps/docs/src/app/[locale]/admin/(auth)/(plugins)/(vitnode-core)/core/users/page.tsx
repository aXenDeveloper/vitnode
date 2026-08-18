import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { DataTableSkeleton } from "@vitnode/core/components/table/data-table";
import { HeaderContent } from "@vitnode/core/components/ui/header-content";
import { checkAdminPermissionApi } from "@vitnode/core/lib/api/get-session-admin-api";
import { CreateUserAdmin } from "@vitnode/core/views/admin/views/core/users/actions/create/create";

const UsersAdminView = dynamic(async () =>
  import("@vitnode/core/views/admin/views/core/users/users-admin-view").then(module => ({
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
  const [t, tNav, canView, canCreate] = await Promise.all([
    getTranslations("admin.user.list"),
    getTranslations("admin.global.nav.users"),
    checkAdminPermissionApi({ module: "users", permission: "can_view" }),
    checkAdminPermissionApi({ module: "users", permission: "can_create" }),
  ]);

  if (!canView) {
    notFound();
  }

  return (
    <I18nProvider namespaces="admin.user">
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={tNav("list")}>
          {canCreate && <CreateUserAdmin />}
        </HeaderContent>

        <React.Suspense fallback={<DataTableSkeleton columns={2} toolbar />}>
          <UsersAdminView {...props} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
