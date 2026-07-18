import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { HeaderContent } from "@vitnode/core/components/ui/header-content";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";

const DiscoverView = dynamic(async () =>
  import("@vitnode/core/views/search/discover-view").then(module => ({
    default: module.DiscoverView,
  })),
);

export const generateMetadata = async () => {
  const t = await getTranslations("core.search");

  return {
    title: t("discoverTitle"),
    description: t("discoverDesc"),
    robots: { index: true, follow: true },
  };
};

export default async function Page() {
  const t = await getTranslations("core.search");

  return (
    <I18nProvider namespaces={["core.search"]}>
      <div className="container mx-auto max-w-3xl space-y-6 p-4">
        <HeaderContent desc={t("discoverDesc")} h1={t("discoverTitle")} />

        <React.Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <DiscoverView />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
