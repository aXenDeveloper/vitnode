import { useTranslations } from "use-intl";

export const NotificationsBreadcrumb = () => {
  const t = useTranslations("core.notifications");

  return <>{t("title")}</>;
};
