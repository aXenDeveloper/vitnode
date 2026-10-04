import { useTranslations } from "use-intl";

/** The page's crumb. Its strings come from the route's own namespaces. */
export const NotificationsBreadcrumb = () => {
  const t = useTranslations("core.notifications");

  return <>{t("title")}</>;
};
