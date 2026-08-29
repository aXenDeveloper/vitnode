import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { AdminPermissionRequired } from "@/components/staff-permission/required";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";
import { CONFIG_PLUGIN } from "@/config";
import { ClearCacheAction } from "@/views/admin/views/core/debug/actions/clear-cache/clear-cache";
import { clearCacheMutation } from "@/views/admin/views/core/debug/actions/clear-cache/mutation-api.server";

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
  const t = await getTranslations("admin.debug");

  return (
    <I18nProvider namespaces={["admin.debug", "admin.advanced.queue"]}>
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={t("title")}>
          <AdminStaffPermissionGate
            module="debug"
            permission="can_clear_cache"
            plugin={CONFIG_PLUGIN.pluginId}
          >
            <ClearCacheAction onClearCache={clearCacheMutation} />
          </AdminStaffPermissionGate>
        </HeaderContent>

        <HeaderContent className="mt-8" h2={t("queue.title")} />
        <React.Suspense fallback={<DataTableSkeleton columns={5} />}>
          <AdminPermissionRequired module="debug" permission="can_view">
            <QueueView />
          </AdminPermissionRequired>
        </React.Suspense>

        <HeaderContent className="mt-8" h2={t("logs.title")} />
        <React.Suspense fallback={<DataTableSkeleton columns={4} />}>
          <AdminPermissionRequired module="debug" permission="can_view">
            <SystemLogsView {...props} />
          </AdminPermissionRequired>
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
