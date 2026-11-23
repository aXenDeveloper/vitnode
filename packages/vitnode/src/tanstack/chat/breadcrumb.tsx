import { useTranslations } from "use-intl";

export const ChatBreadcrumb = () => {
  const t = useTranslations("core.global.chat");

  return <>{t("title")}</>;
};

export const ChatNewBreadcrumb = () => {
  const t = useTranslations("core.global.chat.new");

  return <>{t("title")}</>;
};
