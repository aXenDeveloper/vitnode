import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "use-intl";

import {
  reportReasonsQueryOptions,
  resolveReasonText,
} from "./report-reasons-query";

export const ReportReasonLabel = ({ code }: { code: string }) => {
  const locale = useLocale();
  const t = useTranslations("core.moderation");
  const { data } = useQuery(reportReasonsQueryOptions());
  if (!data) return "";
  const reason = data.find(item => item.code === code);

  return reason
    ? resolveReasonText(reason.title, locale) || code
    : t("reason_removed");
};
