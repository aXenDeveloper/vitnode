import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { HeaderContent } from "@vitnode/core/components/ui/header-content";
import { checkAdminPermissionApi } from "@vitnode/core/lib/api/get-session-admin-api";
import {
  IntegrationsView,
  IntegrationsViewSkeleton,
} from "@vitnode/core/views/admin/views/core/system/integrations/integrations-view";

export const generateMetadata = async () => {
  const t = await getTranslations("admin.system.integrations");

  return {
    title: t("title"),
    description: t("desc"),
  };
};

export default async function Page() {
  const [t, canView] = await Promise.all([
    getTranslations("admin.system.integrations"),
    checkAdminPermissionApi({ module: "system", permission: "can_view" }),
  ]);

  if (!canView) {
    notFound();
  }

  return (
    <I18nProvider namespaces="admin.system.integrations">
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={t("title")} />

        <React.Suspense fallback={<IntegrationsViewSkeleton />}>
          <IntegrationsView />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
