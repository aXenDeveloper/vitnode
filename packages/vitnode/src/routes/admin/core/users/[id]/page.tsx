import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { adminModule } from "@/api/modules/admin/admin.module";
import { I18nProvider } from "@/components/i18n-provider";
import { Loader } from "@/components/ui/loader";
import { fetcher } from "@/lib/fetcher";

const ShowUserAdminView = dynamic(async () =>
  import("@/views/admin/views/core/users/show/show-user-admin-view").then(
    module => ({
      default: module.ShowUserAdminView,
    }),
  ),
);

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  const t = await getTranslations("admin.user.show");
  const res = await fetcher(adminModule, {
    path: "/{id}",
    method: "get",
    module: "admin/users",
    args: {
      params: { id },
    },
  });

  if (!res.ok) {
    return {
      title: t("title"),
    };
  }

  const data = await res.json();

  return {
    title: `${data.name} - ${t("title")}`,
  };
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <I18nProvider namespaces={["admin.user", "core.search"]}>
      <div className="p-4">
        <React.Suspense fallback={<Loader />}>
          <ShowUserAdminView id={id} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
