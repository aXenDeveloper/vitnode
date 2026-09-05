"use client";

import { useTranslations } from "use-intl";

import { ErrorContent } from "@/views/error/error-content";

export const NotFound = ({ actions }: { actions?: React.ReactNode }) => {
  const t = useTranslations("core.global");

  return (
    <ErrorContent
      actions={actions}
      code={404}
      description={t("errors.404.desc")}
      title={t("errors.404.title")}
    />
  );
};
