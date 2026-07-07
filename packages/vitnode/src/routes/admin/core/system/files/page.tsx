import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";

const FilesTableView = dynamic(async () =>
  import("@/views/admin/views/core/system/files/files-table-view").then(
    module => ({
      default: module.FilesTableView,
    }),
  ),
);

export const generateMetadata = async () => {
  const t = await getTranslations("admin.system.files");

  return {
    title: t("title"),
    description: t("desc"),
  };
};

export default async function Page(
  props: React.ComponentProps<typeof FilesTableView>,
) {
  const [t, canView] = await Promise.all([
    getTranslations("admin.system.files"),
    checkAdminPermissionApi({ module: "files", permission: "can_view" }),
  ]);

  if (!canView) {
    notFound();
  }

  return (
    <I18nProvider namespaces={["admin.system.files"]}>
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={t("title")} />

        <React.Suspense fallback={<DataTableSkeleton columns={8} />}>
          <FilesTableView {...props} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
