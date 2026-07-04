import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { ClearCacheAction } from "@/views/admin/views/core/debug/actions/clear-cache/clear-cache";

const SystemLogsView = dynamic(async () =>
  import("@/views/admin/views/core/debug/system-logs/system-logs-view").then(
    module => ({
      default: module.SystemLogsView,
    }),
  ),
);

const QueueView = dynamic(async () =>
  import("@/views/admin/views/core/debug/queue/queue-view").then(module => ({
    default: module.QueueView,
  })),
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
  const [t, canView, canClearCache] = await Promise.all([
    getTranslations("admin.debug"),
    checkAdminPermissionApi({ module: "debug", permission: "can_view" }),
    checkAdminPermissionApi({ module: "debug", permission: "can_clear_cache" }),
  ]);

  if (!canView) {
    notFound();
  }

  return (
    <I18nProvider namespaces={["admin.debug", "admin.advanced.queue"]}>
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={t("title")}>
          {canClearCache && <ClearCacheAction />}
        </HeaderContent>

        <HeaderContent className="mt-8" h2={t("queue.title")} />
        <React.Suspense fallback={<DataTableSkeleton columns={5} />}>
          <QueueView />
        </React.Suspense>

        <HeaderContent className="mt-8" h2={t("logs.title")} />
        <React.Suspense fallback={<DataTableSkeleton columns={4} />}>
          <SystemLogsView {...props} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
