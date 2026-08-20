import { getTranslations } from "next-intl/server";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { AdminPermissionRequired } from "@/components/staff-permission/required";
import { HeaderContent } from "@/components/ui/header-content";
import {
  IntegrationsView,
  IntegrationsViewSkeleton,
} from "@/views/admin/views/core/system/integrations/integrations-view";

export const generateMetadata = async () => {
  const t = await getTranslations("admin.system.integrations");

  return {
    title: t("title"),
    description: t("desc"),
  };
};

export default async function Page() {
  const t = await getTranslations("admin.system.integrations");

  return (
    <I18nProvider namespaces="admin.system.integrations">
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={t("title")} />

        <React.Suspense fallback={<IntegrationsViewSkeleton />}>
          <AdminPermissionRequired module="system" permission="can_view">
            <IntegrationsView />
          </AdminPermissionRequired>
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
