import { getTranslations } from "next-intl/server";

import { I18nProvider } from "@/components/i18n-provider";
import { HeaderContent } from "@/components/ui/header-content";

import { StaffTabsAdmin } from "./staff-tabs";

export const LayoutStaffAdmin = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const t = await getTranslations("admin.staff");

  return (
    <I18nProvider namespaces="admin.staff">
      <div className="p-4">
        <HeaderContent desc={t("desc")} h1={t("title")} />

        <StaffTabsAdmin />

        {children}
      </div>
    </I18nProvider>
  );
};
