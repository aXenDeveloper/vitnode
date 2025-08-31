import dynamic from "next/dynamic";
import { getTranslations } from "next-intl/server";
import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { DataTableSkeleton } from "@vitnode/core/components/table/data-table";
import { HeaderContent } from "@vitnode/core/components/ui/header-content";
import { ClearCacheAction } from "@vitnode/core/views/admin/views/core/debug/actions/clear-cache/clear-cache";

const SystemLogsView = dynamic(async () =>
  import("@vitnode/core/views/admin/views/core/debug/system-logs/system-logs-view").then(
    module => ({
      default: module.SystemLogsView,
    }),
  ),
);

export const generateMetadata = async () => {
  const t = await getTranslations("admin.debug");

  return {
    title: t("title"),
    description: t("desc"),
  };
};

export default async function Page(
  props: React.ComponentProps<typeof SystemLogsView>,
) {
  const t = await getTranslations("admin.debug");

  return (
    <I18nProvider namespaces="admin.debug">
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={t("title")}>
          <ClearCacheAction />
        </HeaderContent>

        <HeaderContent h2={t("logs.title")} />
        <React.Suspense fallback={<DataTableSkeleton columns={4} />}>
          <SystemLogsView {...props} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
