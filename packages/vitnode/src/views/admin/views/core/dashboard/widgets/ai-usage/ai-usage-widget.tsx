import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ArrowRightIcon,
  RotateCwIcon,
  SparklesIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AiActionTranslate,
  translateAiActionText,
} from "@/lib/ai/action-text";
import { useAdminIdentity } from "@/tanstack/admin/identity";
import { RouteMessages } from "@/tanstack/i18n/route-messages";
import { AdminLink } from "@/views/admin/layouts/admin-link";
import {
  adminAiActionsQueryOptions,
  adminAiOverviewQueryOptions,
} from "@/views/admin/views/core/ai/ai-query";
import { useOverviewFormat } from "@/views/admin/views/core/ai/overview/overview-format";
import {
  dayAsDate,
  measureValue,
  usdNumber,
} from "@/views/admin/views/core/ai/overview/overview-metrics";

const AI_USAGE_NAMESPACES = [
  "admin.dashboard",
  "core.global",
  "ai_actions",
] as const;
const AI_OVERVIEW_HREF = "/admin/core/ai";
const DAY_MS = 86_400_000;
const TOP_FEATURES = 4;
const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const;
const GROW_S = 0.32;
const STAGGER_S = 0.045;

const toneOf = (ratio: number) =>
  ratio >= 0.9
    ? { bar: "bg-destructive", text: "text-destructive" }
    : ratio >= 0.8
      ? { bar: "bg-warn", text: "text-warn" }
      : { bar: "bg-primary", text: "text-foreground" };

const GrowBar = ({
  className,
  delay = 0,
  width,
}: {
  className: string;
  delay?: number;
  width: number;
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <m.span
      animate={{ scaleX: 1 }}
      className={cn("block h-full origin-left rounded-full", className)}
      initial={reduceMotion ? false : { scaleX: 0 }}
      style={{ width: `${Math.min(1, Math.max(0, width)) * 100}%` }}
      transition={{ delay, duration: GROW_S, ease: EASE_OUT_QUINT }}
    />
  );
};

const AiUsageSkeleton = () => (
  <div aria-hidden="true" className="flex flex-1 flex-col">
    <div className="flex flex-col gap-2.5 border-b px-4 pt-3 pb-4">
      <div className="flex justify-between gap-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-4 w-48" />
    </div>
    {Array.from({ length: 4 }, (_, index) => (
      <div className="flex items-center gap-3 border-b px-4 py-2.5" key={index}>
        <Skeleton className="size-8 shrink-0" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

const AiUsageContent = () => {
  const t = useTranslations("admin.dashboard.widgets.ai-usage");
  const tGlobal = useTranslations("core.global");
  const tAll = useTranslations() as unknown as AiActionTranslate;
  const locale = useLocale();
  const formatter = useOverviewFormat();
  const adminUserId = useAdminIdentity();
  const overview = useQuery(
    adminAiOverviewQueryOptions({
      adminUserId,
      search: { range: "this-month" },
    }),
  );
  const actions = useQuery(adminAiActionsQueryOptions({ adminUserId }));
  const percent = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
        signDisplay: "exceptZero",
        style: "percent",
      }),
    [locale],
  );
  const actionsByKey = React.useMemo(
    () =>
      new Map(
        (actions.data?.actions ?? []).map(action => [action.key, action]),
      ),
    [actions.data],
  );

  if (overview.isPending) {
    return (
      <div aria-busy="true" className="flex flex-1 flex-col" role="status">
        <span className="sr-only">{tGlobal("loading")}</span>
        <AiUsageSkeleton />
      </div>
    );
  }

  if (overview.isError) {
    return (
      <Empty className="flex-1 p-6" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SparklesIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("load_error.title")}</EmptyTitle>
          <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            isLoading={overview.isFetching}
            onClick={() => void overview.refetch()}
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

  const { budget, byAction, today } = overview.data;
  const spent = usdNumber(budget.spentUsd);
  const limit = budget.limitUsd === null ? null : usdNumber(budget.limitUsd);
  const forecast = usdNumber(budget.forecastUsd ?? budget.spentUsd);
  const ratio = limit === null || limit === 0 ? 0 : spent / limit;
  const forecastRatio = limit === null || limit === 0 ? 0 : forecast / limit;
  const tone = toneOf(ratio);
  const daysLeft = Math.max(
    0,
    Math.round(
      (dayAsDate(budget.end).getTime() - dayAsDate(today).getTime()) / DAY_MS,
    ),
  );
  const features = byAction
    .map(entity => ({
      current: measureValue("cost", entity.current),
      key: entity.key,
      previous: measureValue("cost", entity.previous),
    }))
    .filter(feature => feature.current > 0)
    .sort((a, b) => b.current - a.current);
  const shown = features.slice(0, TOP_FEATURES);
  const rest = features.slice(TOP_FEATURES);
  const rows = [
    ...shown.map(feature => {
      const action = actionsByKey.get(feature.key);

      return {
        ...feature,
        icon: action?.icon ?? null,
        label: action ? translateAiActionText(tAll, action.title) : feature.key,
      };
    }),
    ...(rest.length > 0
      ? [
          {
            current: rest.reduce((sum, feature) => sum + feature.current, 0),
            icon: null,
            key: "other",
            label: t("other"),
            previous: rest.reduce((sum, feature) => sum + feature.previous, 0),
          },
        ]
      : []),
  ];
  const featuresTotal = rows.reduce((sum, row) => sum + row.current, 0);
  const top = Math.max(0, ...rows.map(row => row.current));

  return (
    <MotionFeatures>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-2.5 border-b px-4 pt-3 pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="flex items-baseline gap-1.5">
              <span className="text-2xl leading-none font-semibold tabular-nums">
                {formatter.usd(spent)}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {limit === null
                  ? t("this_month")
                  : t("of_limit", { limit: formatter.usd(limit) })}
              </span>
            </p>
            {limit === null ? (
              <span className="text-muted-foreground text-sm">
                {t("no_limit")}
              </span>
            ) : (
              <span
                className={cn("text-sm font-medium tabular-nums", tone.text)}
              >
                {t("used", { percent: Math.round(ratio * 100) })}
              </span>
            )}
          </div>

          {limit === null ? null : (
            <div
              aria-label={t("limit_bar")}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.min(100, Math.round(ratio * 100))}
              className="bg-muted relative h-2 rounded-full"
              role="progressbar"
            >
              <span className="absolute inset-0 overflow-hidden rounded-full">
                <GrowBar className={tone.bar} width={ratio} />
              </span>
              <span
                aria-hidden="true"
                className="bg-foreground absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full"
                style={{ left: `${Math.min(1, forecastRatio) * 100}%` }}
              />
            </div>
          )}

          <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums">
            {limit === null ? null : (
              <span
                aria-hidden="true"
                className="bg-foreground h-3 w-0.5 rounded-full"
              />
            )}
            <span>
              {t.rich("forecast", {
                amount: formatter.usd(forecast),
                value: chunks => (
                  <span
                    className={cn(
                      "font-medium",
                      forecastRatio > 1
                        ? "text-destructive"
                        : "text-foreground",
                    )}
                  >
                    {chunks}
                  </span>
                ),
              })}
              {forecastRatio > 1 ? ` · ${t("over_limit")}` : ""}
            </span>
            <span aria-hidden="true">·</span>
            <span>{t("days_left", { count: daysLeft })}</span>
          </p>
        </div>

        {rows.length === 0 ? (
          <Empty className="flex-1 p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SparklesIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("empty_title")}</EmptyTitle>
              <EmptyDescription>{t("empty_desc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-border flex flex-col divide-y">
            {rows.map((row, at) => {
              const change =
                row.previous === 0
                  ? null
                  : (row.current - row.previous) / row.previous;

              return (
                <li
                  className="flex items-center gap-3 px-4 py-2.5"
                  key={row.key}
                >
                  <span
                    aria-hidden="true"
                    className="bg-muted/60 text-muted-foreground ring-foreground/10 flex size-8 shrink-0 items-center justify-center rounded-md ring-1 [&_svg]:size-4"
                  >
                    {row.icon ? (
                      <DynamicIcon
                        fallback={<SparklesIcon />}
                        name={row.icon}
                      />
                    ) : (
                      <SparklesIcon />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{row.label}</span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatter.usd(row.current)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                        <GrowBar
                          className="bg-primary"
                          delay={at * STAGGER_S}
                          width={top === 0 ? 0 : row.current / top}
                        />
                      </span>
                      <span className="text-muted-foreground w-9 shrink-0 text-end text-xs tabular-nums">
                        {Math.round(
                          (featuresTotal === 0
                            ? 0
                            : row.current / featuresTotal) * 100,
                        )}
                        %
                      </span>
                      {change === null ? (
                        <Badge
                          className="w-14 justify-center"
                          variant="outline"
                        >
                          {t("new")}
                        </Badge>
                      ) : (
                        <span
                          className={cn(
                            "flex w-14 shrink-0 items-center justify-end gap-0.5 text-xs font-medium tabular-nums",
                            change > 0 ? "text-destructive" : "text-success",
                          )}
                        >
                          {change > 0 ? (
                            <TrendingUpIcon
                              aria-hidden="true"
                              className="size-3.5"
                            />
                          ) : (
                            <TrendingDownIcon
                              aria-hidden="true"
                              className="size-3.5"
                            />
                          )}
                          {percent.format(change)}
                          <span className="sr-only">{t("vs_last_month")}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-3">
          <AdminLink
            className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            href={AI_OVERVIEW_HREF}
          >
            {t("overview")}
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </AdminLink>
          <span className="text-muted-foreground text-xs">{t("footer")}</span>
        </div>
      </div>
    </MotionFeatures>
  );
};

export const AiUsageWidget = () => (
  <RouteMessages namespaces={AI_USAGE_NAMESPACES}>
    <AiUsageContent />
  </RouteMessages>
);
