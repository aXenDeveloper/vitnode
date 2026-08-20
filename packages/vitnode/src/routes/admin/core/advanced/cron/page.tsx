import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { AdminPermissionRequired } from "@/components/staff-permission/required";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";

const CronTableView = dynamic(async () =>
  import("@/views/admin/views/core/advanced/cron/cron-table-view").then(
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
          <AdminPermissionRequired module="cron" permission="can_view">
            <CronTableView {...props} />
          </AdminPermissionRequired>
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
