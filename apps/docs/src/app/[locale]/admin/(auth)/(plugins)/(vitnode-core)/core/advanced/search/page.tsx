import { getTranslations } from "next-intl/server";
import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { AdminPermissionRequired } from "@vitnode/core/components/staff-permission/required";
import { HeaderContent } from "@vitnode/core/components/ui/header-content";
import { SearchHeaderActions } from "@vitnode/core/views/admin/views/core/advanced/search/search-header-actions";
import {
  SearchAdminView,
  SearchAdminViewSkeleton,
} from "@vitnode/core/views/admin/views/core/advanced/search/search-view";

export const generateMetadata = async () => {
  const t = await getTranslations("core.search");

  return {
    title: t("admin.title"),
    description: t("admin.desc"),
  };
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const t = await getTranslations("core.search");

  return (
    <I18nProvider namespaces="core.search">
      <div className="p-4">
        <HeaderContent desc={t("admin.desc")} h1={t("admin.title")}>
          <SearchHeaderActions />
        </HeaderContent>

        <React.Suspense fallback={<SearchAdminViewSkeleton />}>
          <AdminPermissionRequired module="system" permission="can_view">
            <SearchAdminView searchParams={searchParams} />
          </AdminPermissionRequired>
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
