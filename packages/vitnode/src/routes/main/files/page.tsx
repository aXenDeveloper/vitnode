import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";
import { getSessionApi } from "@/lib/api/get-session-api";
import { UploadMyFiles } from "@/views/files/actions/upload-files";

const MyFilesTableView = dynamic(async () =>
  import("@/views/files/my-files-table-view").then(module => ({
    default: module.MyFilesTableView,
  })),
);

export const instant = false;

export const generateMetadata = async () => {
  const t = await getTranslations("core.files");

  return {
    title: t("title"),
    description: t("desc"),
    robots: { index: false, follow: false },
  };
};

export default async function Page(
  props: React.ComponentProps<typeof MyFilesTableView>,
) {
  const [t, session] = await Promise.all([
    getTranslations("core.files"),
    getSessionApi(),
  ]);

  if (!session.user) {
    notFound();
  }

  return (
    <I18nProvider namespaces={["core.files"]}>
      <div className="container mx-auto space-y-6 p-4">
        <HeaderContent desc={t("desc")} h1={t("title")}>
          <UploadMyFiles />
        </HeaderContent>

        <React.Suspense fallback={<DataTableSkeleton columns={7} toolbar />}>
          <MyFilesTableView {...props} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
