"use client";

import { useTranslations } from "use-intl";

export const NoResultsDataTable = ({
  description,
  title,
}: {
  description?: string;
  title?: string;
}) => {
  const t = useTranslations("core.global.no_results");

  return (
    <>
      <h3 className="text-xl font-semibold tracking-tight">
        {title ?? t("title")}
      </h3>
      <p className="text-muted-foreground text-sm">
        {description ?? t("desc")}
      </p>
    </>
  );
};
