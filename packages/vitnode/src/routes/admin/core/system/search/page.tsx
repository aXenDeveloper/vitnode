import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { HeaderContent } from "@/components/ui/header-content";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import {
  SearchAdminView,
  SearchAdminViewSkeleton,
} from "@/views/admin/views/core/system/search/search-view";

export const generateMetadata = async () => {
  const t = await getTranslations("core.search");

  return {
    title: t("admin.title"),
    description: t("admin.desc"),
  };
};

export default async function Page() {
  const [t, canView] = await Promise.all([
    getTranslations("core.search"),
    checkAdminPermissionApi({ module: "system", permission: "can_view" }),
  ]);

  if (!canView) {
    notFound();
  }

  return (
    <I18nProvider namespaces="core.search">
      <div className="p-4">
        <HeaderContent desc={t("admin.desc")} h1={t("admin.title")} />

        <React.Suspense fallback={<SearchAdminViewSkeleton />}>
          <SearchAdminView />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
