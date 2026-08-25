import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { AdminPermissionRequired } from "@vitnode/core/components/staff-permission/required";
import { DataTableSkeleton } from "@vitnode/core/components/table/data-table";
import { HeaderContent } from "@vitnode/core/components/ui/header-content";

const FilesTableView = dynamic(async () =>
  import("@vitnode/core/views/admin/views/core/system/files/files-table-view").then(
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
  const t = await getTranslations("admin.system.files");

  return (
    <I18nProvider namespaces={["admin.system.files"]}>
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={t("title")} />

        <React.Suspense fallback={<DataTableSkeleton columns={9} toolbar />}>
          <AdminPermissionRequired module="files" permission="can_view">
            <FilesTableView {...props} />
          </AdminPermissionRequired>
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
