import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  RotateCwIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UserPlusIcon,
  UserRoundXIcon,
} from "lucide-react";
import React from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAdminIdentity } from "@/tanstack/admin/identity";

import { SignUpsChart } from "./sign-ups-chart";
import {
  SIGN_UP_RANGES,
  type SignUpRange,
  signUpsQueryOptions,
} from "./sign-ups-query";

const DEFAULT_RANGE: SignUpRange = 14;
const HISTORY_DAYS: SignUpRange = 30;

const isRange = (value: number): value is SignUpRange =>
  (SIGN_UP_RANGES as readonly number[]).includes(value);

const NewMembersSkeleton = () => (
  <div aria-hidden="true" className="flex flex-1 flex-col gap-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-8 w-28 rounded-lg" />
    </div>
    <Skeleton className="h-5 w-56" />
    <Skeleton className="mt-auto h-28 w-full" />
    <Skeleton className="h-4 w-full" />
  </div>
);

export const NewMembersWidget = () => {
  const t = useTranslations("admin.dashboard.widgets.new-members");
  const tGlobal = useTranslations("core.global");
  const format = useFormatter();
  const locale = useLocale();
  const adminUserId = useAdminIdentity();
  const [range, setRange] = React.useState<SignUpRange>(DEFAULT_RANGE);
  const query = useQuery(
    signUpsQueryOptions({ adminUserId, days: HISTORY_DAYS }),
  );
  const percent = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
        signDisplay: "exceptZero",
        style: "percent",
      }),
    [locale],
  );
  const history = query.data?.days;
  const current = React.useMemo(
    () => history?.slice(-range) ?? [],
    [history, range],
  );
  const previous = React.useMemo(
    () => history?.slice(-2 * range, -range) ?? [],
    [history, range],
  );

  if (query.isPending) {
    return (
      <div aria-busy="true" className="flex flex-1 flex-col" role="status">
        <span className="sr-only">{tGlobal("loading")}</span>
        <NewMembersSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Empty className="flex-1 p-0" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRoundXIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("load_error.title")}</EmptyTitle>
          <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            size="sm"
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (query.data.days.every(day => day.count === 0)) {
    return (
      <Empty className="flex-1 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserPlusIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("empty_title")}</EmptyTitle>
          <EmptyDescription>{t("empty_desc")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const total = current.reduce((sum, day) => sum + day.count, 0);
  const previousTotal = previous.reduce((sum, day) => sum + day.count, 0);
  const change =
    previousTotal === 0 ? null : (total - previousTotal) / previousTotal;
  const firstDay = current[0]?.day;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <SlidingNumber
            className="text-3xl leading-none font-semibold"
            value={total}
          />
          <span className="text-muted-foreground text-sm">
            {t("total", { days: range })}
          </span>
        </div>
        <ToggleGroup
          aria-label={t("range")}
          onValueChange={(next: string[]) => {
            const picked = Number(next.at(-1));
            if (isRange(picked)) setRange(picked);
          }}
          size="sm"
          value={[String(range)]}
        >
          {SIGN_UP_RANGES.map(option => (
            <ToggleGroupItem
              aria-label={t("range_option", { days: option })}
              key={option}
              value={String(option)}
            >
              {t("range_short", { days: option })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {change === null ? null : (
        <p
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            change > 0
              ? "text-success"
              : change < 0
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {change >= 0 ? (
            <TrendingUpIcon aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <TrendingDownIcon aria-hidden="true" className="size-4 shrink-0" />
          )}
          <SlidingNumber formatter={percent} value={change} />
          <span className="text-muted-foreground font-normal">
            {t("change", {
              count: format.number(previousTotal),
              days: range,
            })}
          </span>
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <SignUpsChart current={current} days={range} previous={previous} />
        <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
          <span>
            {firstDay
              ? format.dateTime(new Date(`${firstDay}T00:00:00Z`), {
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })
              : null}
          </span>
          <span>{t("today")}</span>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="bg-primary h-0.5 w-3 rounded-full"
            />
            {t("current", { days: range })}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="border-muted-foreground w-3 border-t-2 border-dashed"
            />
            {t("previous", { days: range })}
          </span>
          <span className="ms-auto tabular-nums">
            {t("members_total", { count: query.data.total })}
          </span>
        </div>
      </div>
    </div>
  );
};
