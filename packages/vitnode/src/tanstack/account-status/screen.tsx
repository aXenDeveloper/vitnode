import { useTranslations } from "use-intl";

import { AccountStatusContent } from "@/views/moderation/warnings/account-status-content";

import { RouteMessages } from "../i18n/route-messages";
import { ACCOUNT_STATUS_NAMESPACES } from "./route";

export const AccountStatusBreadcrumb = () => {
  const t = useTranslations("core.moderation.account_status");

  return <>{t("title")}</>;
};

export const AccountStatusRouteContent = () => (
  <RouteMessages namespaces={ACCOUNT_STATUS_NAMESPACES}>
    <AccountStatusContent />
  </RouteMessages>
);
