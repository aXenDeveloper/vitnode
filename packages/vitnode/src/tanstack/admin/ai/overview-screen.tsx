import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslations } from "use-intl";

import type { AiOverviewPeriod } from "@/views/admin/views/core/ai/ai-query";

import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { AI_OVERVIEW_PERIODS } from "@/views/admin/views/core/ai/ai-query";
import { AiOverviewContent } from "@/views/admin/views/core/ai/overview/overview-content";

import type { AdminAiOverviewRouteData } from "./route";
import type { AiOverviewRouteSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { adminAiActionsQuery, adminAiOverviewQuery } from "./query";
import { ADMIN_AI_NAMESPACES } from "./route";

export interface AdminAiOverviewRouteProps extends AdminAiOverviewRouteData {
  navigate: (options: {
    resetScroll: boolean;
    search: AiOverviewRouteSearch;
  }) => Promise<void>;
}

const PeriodSwitch = ({
  onChange,
  period,
}: {
  onChange: (period: AiOverviewPeriod) => void;
  period: AiOverviewPeriod;
}) => {
  const t = useTranslations("admin.ai.overview.period");

  return (
    <div aria-label={t("label")} className="flex gap-2" role="group">
      {AI_OVERVIEW_PERIODS.map(value => (
        <Button
          aria-pressed={value === period}
          key={value}
          onClick={() => {
            onChange(value);
          }}
          size="sm"
          variant={value === period ? "secondary" : "ghost"}
        >
          {t(value)}
        </Button>
      ))}
    </div>
  );
};

export const AdminAiOverviewRouteContent = ({
  adminUserId,
  description,
  navigate,
  period,
  title,
}: AdminAiOverviewRouteProps) => {
  const { data } = useSuspenseQuery(
    adminAiOverviewQuery({ adminUserId, period }),
  );
  const { data: actionsData } = useSuspenseQuery(
    adminAiActionsQuery({ adminUserId }),
  );
  const titles = React.useMemo(
    () =>
      new Map(actionsData.actions.map(action => [action.key, action.title])),
    [actionsData.actions],
  );

  return (
    <RouteMessages namespaces={ADMIN_AI_NAMESPACES}>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <PageTitle className="mb-0" desc={description} h1={title}>
          <PeriodSwitch
            onChange={next => {
              void navigate({
                resetScroll: false,
                search: next === "previous" ? { period: "previous" } : {},
              });
            }}
            period={period}
          />
        </PageTitle>

        <AiOverviewContent
          data={data}
          describeAction={key => titles.get(key) ?? null}
        />
      </div>
    </RouteMessages>
  );
};
