import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { DataTableSkeleton } from "@vitnode/core/components/table/data-table";
import { HeaderContent } from "@vitnode/core/components/ui/header-content";
import { checkAdminPermissionApi } from "@vitnode/core/lib/api/get-session-admin-api";

const QueueTableView = dynamic(async () =>
  import("@vitnode/core/views/admin/views/core/advanced/queue/queue-table-view").then(
    module => ({
      default: module.QueueTableView,
    }),
  ),
);

export const generateMetadata = async () => {
  const t = await getTranslations("admin.advanced.queue");

  return {
    title: t("title"),
    description: t("desc"),
  };
};

export default async function Page(
  props: React.ComponentProps<typeof QueueTableView>,
) {
  const [t, canView] = await Promise.all([
    getTranslations("admin.advanced.queue"),
    checkAdminPermissionApi({ module: "queue", permission: "can_view" }),
  ]);

  if (!canView) {
    notFound();
  }

  return (
    <I18nProvider namespaces={["admin.advanced.queue"]}>
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={t("title")} />

        <React.Suspense fallback={<DataTableSkeleton columns={7} toolbar />}>
          <QueueTableView {...props} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
