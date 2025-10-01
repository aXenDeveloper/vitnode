import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { DataTableSkeleton } from "@vitnode/core/components/table/data-table";
import { HeaderContent } from "@vitnode/core/components/ui/header-content";

const CronTableView = dynamic(async () =>
  import("@vitnode/core/views/admin/views/core/advanced/cron/cron-table-view").then(
    module => ({
      default: module.CronTableView,
    }),
  ),
);

export const generateMetadata = async () => {
  const t = await getTranslations("admin.advanced.cron");

  return {
    title: t("title"),
    description: t("desc"),
  };
};

export default async function Page(
  props: React.ComponentProps<typeof CronTableView>,
) {
  const t = await getTranslations("admin.advanced.cron");

  return (
    <I18nProvider namespaces={["admin.advanced.cron"]}>
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={t("title")} />

        <React.Suspense fallback={<DataTableSkeleton columns={6} />}>
          <CronTableView {...props} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
