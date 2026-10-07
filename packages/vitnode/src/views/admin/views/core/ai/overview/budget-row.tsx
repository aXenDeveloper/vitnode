import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { aiMonthOf, countAiDays, shiftAiMonth } from "@/lib/ai/overview-range";

import type { AdminAiOverview } from "../ai-query";

import { useOverviewFormat } from "./overview-format";
import { usdNumber } from "./overview-metrics";

const useBasis = (data: AdminAiOverview): string => {
  const t = useTranslations("admin.ai.overview.basis");
  const formatter = useOverviewFormat();
  const { preset } = data.range;

  return preset
    ? t(preset)
    : t("custom", { range: formatter.range(data.range.start, data.range.end) });
};

const BudgetAlert = ({ data }: { data: AdminAiOverview }) => {
  const t = useTranslations("admin.ai.overview.budget");
  const formatter = useOverviewFormat();
  const basis = useBasis(data);
  const { budget } = data;
  const limit = budget.limitUsd === null ? null : usdNumber(budget.limitUsd);
  const spent = usdNumber(budget.spentUsd);
  const rate = formatter.usd(usdNumber(budget.dailyRateUsd));
  const month = formatter.month(budget.month);
  const settingsLink = (label: string) => (
    <Link to="/admin/core/ai/settings">{label}</Link>
  );

  if (budget.live) {
    const forecast = usdNumber(budget.forecastUsd ?? budget.spentUsd);
    const values = {
      end: formatter.day(budget.end),
      forecast: formatter.usd(forecast),
    };

    if (limit === null) {
      return (
        <Alert className="lg:max-w-md" variant="info">
          <AlertTitle>{t("forecast_no_limit", values)}</AlertTitle>
          <AlertDescription>{t("basis", { basis, rate })}</AlertDescription>
        </Alert>
      );
    }

    const over = forecast - limit;

    return (
      <Alert className="lg:max-w-md" variant={over > 0 ? "warning" : "success"}>
        <AlertTitle>
          {over > 0
            ? t("forecast_over", { ...values, over: formatter.usd(over) })
            : t("forecast_inside", values)}
        </AlertTitle>
        <AlertDescription>
          {t("basis", { basis, rate })}
          {over > 0 ? <> {settingsLink(t("change_limit"))}</> : null}
        </AlertDescription>
      </Alert>
    );
  }

  const monthly = usdNumber(budget.monthlyAtRateUsd);

  if (limit === null) {
    return (
      <Alert className="lg:max-w-md" variant="info">
        <AlertTitle>
          {t("closed_no_limit", { month, spent: formatter.usd(spent) })}
        </AlertTitle>
        <AlertDescription>
          {t("pace_no_limit", {
            basis,
            monthly: formatter.usd(monthly),
            rate,
          })}
        </AlertDescription>
      </Alert>
    );
  }

  const paceOver = monthly - limit;

  return (
    <Alert
      className="lg:max-w-md"
      variant={spent > limit ? "warning" : "success"}
    >
      <AlertTitle>
        {t("closed", {
          month,
          share: formatter.percent(spent / limit, 0),
          spent: formatter.usd(spent),
        })}
      </AlertTitle>
      <AlertDescription>
        {paceOver > 0
          ? t("pace_over", {
              basis,
              monthly: formatter.usd(monthly),
              over: formatter.usd(paceOver),
              rate,
            })
          : t("pace_inside", {
              basis,
              monthly: formatter.usd(monthly),
              rate,
            })}
      </AlertDescription>
    </Alert>
  );
};

export const AiBudgetRow = ({
  data,
  onMonthChange,
}: {
  data: AdminAiOverview;
  onMonthChange: (month: string) => void;
}) => {
  const t = useTranslations("admin.ai.overview.budget");
  const formatter = useOverviewFormat();
  const { budget } = data;
  const limit = budget.limitUsd === null ? null : usdNumber(budget.limitUsd);
  const spent = usdNumber(budget.spentUsd);
  const forecast = usdNumber(budget.forecastUsd ?? budget.spentUsd);
  const previousMonth = shiftAiMonth(budget.month, -1);
  const nextMonth = shiftAiMonth(budget.month, 1);
  const firstMonth = data.firstDay ? aiMonthOf(data.firstDay) : budget.month;
  const monthDays = countAiDays(budget);
  const warn =
    limit !== null && (budget.live ? forecast > limit : spent > limit);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-1">
          <Button
            aria-label={t("show_month", {
              month: formatter.month(previousMonth),
            })}
            disabled={previousMonth < firstMonth}
            onClick={() => {
              onMonthChange(previousMonth);
            }}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronLeftIcon />
          </Button>
          <p aria-live="polite" className="text-muted-foreground text-xs">
            <span className="text-foreground font-medium">
              {t("title", { month: formatter.month(budget.month) })}
            </span>
          </p>
          <Button
            aria-label={t("show_month", { month: formatter.month(nextMonth) })}
            disabled={nextMonth > aiMonthOf(data.today)}
            onClick={() => {
              onMonthChange(nextMonth);
            }}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronRightIcon />
          </Button>
        </div>
        <p className="text-muted-foreground flex flex-wrap items-baseline justify-between gap-x-3 text-sm tabular-nums">
          <span>
            <span className="text-foreground text-2xl font-semibold tracking-tight">
              <SlidingNumber
                formatter={formatter.numberFormat("usd", spent)}
                value={spent}
              />
            </span>
            {limit === null
              ? null
              : ` ${t("of_limit", { limit: formatter.usd(limit) })}`}
          </span>
          <span>
            {budget.live
              ? t("day_of", { day: budget.days.length, days: monthDays })
              : t("month_closed")}
          </span>
        </p>
        {limit === null ? (
          <p className="text-muted-foreground text-sm">
            {t("no_limit")}{" "}
            <Link
              className="text-foreground underline underline-offset-3"
              to="/admin/core/ai/settings"
            >
              {t("set_limit")}
            </Link>
          </p>
        ) : (
          <div
            aria-label={t("meter", {
              limit: formatter.usd(limit),
              spent: formatter.usd(spent),
            })}
            className="relative"
            role="img"
          >
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full",
                  warn ? "bg-warn" : "bg-primary",
                )}
                style={{ width: `${Math.min(spent / limit, 1) * 100}%` }}
              />
            </div>
            {budget.live ? (
              <span
                aria-hidden
                className="bg-foreground absolute -top-1 -bottom-1 w-0.5 rounded-full"
                style={{ left: `${(budget.days.length / monthDays) * 100}%` }}
              />
            ) : null}
          </div>
        )}
      </div>
      <BudgetAlert data={data} />
    </div>
  );
};
