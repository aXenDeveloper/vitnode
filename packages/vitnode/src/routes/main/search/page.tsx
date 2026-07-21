import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { HeaderContent } from "@/components/ui/header-content";
import { Skeleton } from "@/components/ui/skeleton";

const SearchView = dynamic(async () =>
  import("@/views/search/search-view").then(module => ({
    default: module.SearchView,
  })),
);

export const generateMetadata = async () => {
  const t = await getTranslations("core.search");

  return {
    title: t("title"),
    description: t("desc"),
    robots: { index: true, follow: true },
  };
};

export default async function Page(
  props: React.ComponentProps<typeof SearchView>,
) {
  const t = await getTranslations("core.search");

  return (
    <I18nProvider namespaces={["core.search"]}>
      <div className="container mx-auto max-w-3xl space-y-6 p-4">
        <HeaderContent desc={t("desc")} h1={t("title")} />

        <React.Suspense
          fallback={<Skeleton className="h-64 w-full rounded-xl" />}
        >
          <SearchView {...props} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
