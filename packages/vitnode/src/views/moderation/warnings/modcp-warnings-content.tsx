import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "use-intl";

import { FiltersDataTable } from "@/components/table/filters";
import { useDataTableUrl } from "@/components/table/navigation";
import { withTableFilter } from "@/components/table/url-state";
import { PageTitle } from "@/components/ui/page-title";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ModcpWarningsFilter } from "./warnings-api";

import { resolveReasonText } from "../report-reasons-query";
import {
  MemberBand,
  MemberFilter,
  WarnMemberButton,
} from "./modcp-warnings-member";
import { ModcpWarningsTable } from "./modcp-warnings-table";
import {
  warningReasonsQueryOptions,
  warningsListQueryOptions,
} from "./warnings-api";

export const MODCP_WARNING_STATUSES = [
  "all",
  "active",
  "expired",
  "revoked",
] as const;

const StatusTabs = ({ status }: { status: ModcpWarningsFilter["status"] }) => {
  const t = useTranslations("core.moderation.warn");
  const { navigate, searchParams } = useDataTableUrl();

  return (
    <Tabs
      className="max-w-full overflow-x-auto"
      onValueChange={(value: ModcpWarningsFilter["status"]) => {
        navigate(
          withTableFilter(searchParams, {
            id: "status",
            values: value === "all" ? [] : [value],
          }),
        );
      }}
      value={status}
    >
      <TabsList aria-label={t("list.status_label")}>
        {MODCP_WARNING_STATUSES.map(value => (
          <TabsTrigger className="px-3" key={value} value={value}>
            {value === "all" ? t("list.all") : t(`statuses.${value}`)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

const ReasonFilter = () => {
  const t = useTranslations("core.moderation.warn");
  const locale = useLocale();
  // Moderators who can only view warnings cannot list reasons; no filter then.
  const reasons = useQuery(warningReasonsQueryOptions());
  if (!reasons.data || reasons.data.length === 0) return null;

  return (
    <FiltersDataTable
      filters={[
        {
          id: "reason",
          label: t("list.reason_filter"),
          options: reasons.data.map(reason => {
            const label = resolveReasonText(reason.title, locale);

            return { keywords: [label], label, value: String(reason.id) };
          }),
          single: { allLabel: t("list.all_reasons") },
        },
      ]}
    />
  );
};

/** The ModCP warning log: every warning the moderator may see, filtered. */
export const ModcpWarningsContent = ({
  description,
  filter,
  title,
}: {
  description: string;
  filter: ModcpWarningsFilter;
  title: string;
}) => {
  const { data } = useSuspenseQuery(warningsListQueryOptions(filter));
  const { userId } = filter;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle className="mb-0" desc={description} h1={title} />
        {data.permissions.warn && userId === undefined ? (
          <WarnMemberButton />
        ) : null}
      </div>
      <ModcpWarningsTable
        data={data}
        header={
          <div className="flex w-full flex-col gap-3">
            <MemberBand userId={userId ?? null} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusTabs status={filter.status} />
              <div className="flex flex-wrap items-center gap-2">
                <MemberFilter />
                <ReasonFilter />
              </div>
            </div>
          </div>
        }
        label={title}
      />
    </div>
  );
};
