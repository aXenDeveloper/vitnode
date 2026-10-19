import { queryOptions } from "@tanstack/react-query";

import type { MultiLangValue } from "@/lib/helpers/multi-lang";

import { resolveLangValue } from "@/lib/helpers/multi-lang";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";
import { getIntlRuntime } from "@/tanstack/i18n/runtime";

import { ModcpRequestError } from "./modcp/modcp-query";

const fetchReportReasons = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "moderation",
    path: "/reasons",
  });
  if (!response.ok) {
    throw new ModcpRequestError(response.status, "report reasons");
  }

  return (await response.json()).reasons;
};

export type ReportReasonOption = Awaited<
  ReturnType<typeof fetchReportReasons>
>[number];

export const REPORT_REASONS_QUERY_KEY = [
  "vitnode",
  "moderation",
  "report-reasons",
] as const;

export const reportReasonsQueryOptions = () =>
  queryOptions({
    queryFn: fetchReportReasons,
    queryKey: REPORT_REASONS_QUERY_KEY,
    staleTime: 60_000,
  });

export const resolveReasonText = (value: MultiLangValue, locale: string) =>
  resolveLangValue(value, {
    defaultLanguage: getIntlRuntime().defaultLocale,
    locale,
  });
