import { useTranslations } from "use-intl";

export const ModcpBreadcrumb = () => {
  const t = useTranslations("core.moderation.modcp");

  return <>{t("title")}</>;
};

export const ModcpReportsBreadcrumb = () => {
  const t = useTranslations("core.moderation.modcp.reports");

  return <>{t("title")}</>;
};

export const ModcpReportBreadcrumb = ({
  loaderData,
}: {
  loaderData?: { id: number };
}) => {
  const t = useTranslations("core.moderation.modcp.detail");

  return <>{t("title", { id: loaderData?.id ?? 0 })}</>;
};

export const ModcpApprovalsBreadcrumb = () => {
  const t = useTranslations("core.moderation.modcp.approvals");

  return <>{t("title")}</>;
};

export const ModcpApprovalBreadcrumb = ({
  loaderData,
}: {
  loaderData?: { id: number };
}) => {
  const t = useTranslations("core.moderation.modcp.approvals.detail");

  return <>{t("title", { id: loaderData?.id ?? 0 })}</>;
};
