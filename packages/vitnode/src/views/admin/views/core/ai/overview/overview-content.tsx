import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  AnimatePresence,
  type TargetAndTransition,
  type Transition,
  useReducedMotion,
} from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useTranslations } from "use-intl";

import type { DateRangeValue } from "@/components/ui/date-range-picker";
import type { AiOverviewPreset } from "@/lib/ai/overview-range";

import { MotionFeatures } from "@/components/motion-features";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SlidingNumber } from "@/components/ui/sliding-number";
import {
  AI_OVERVIEW_DEFAULT_PRESET,
  AI_OVERVIEW_PRESETS,
} from "@/lib/ai/overview-range";

import type { AdminAiOverview, AiOverviewSearch } from "../ai-query";
import type { AiOverviewMetric } from "./overview-metrics";

import { AiOverviewBreakdown } from "./breakdown";
import { AiBudgetChart } from "./budget-chart";
import { AiBudgetRow } from "./budget-row";
import { AiDelta } from "./chart-parts";
import { useCompareLabel, useOverviewFormat } from "./overview-format";
import {
  AI_METRIC_SPEC,
  AI_OVERVIEW_METRICS,
  metricValue,
} from "./overview-metrics";
import { AiRunningChart } from "./running-chart";

const CHART_HIDDEN = { opacity: 0, y: 6 } satisfies TargetAndTransition;

const CHART_SHOWN = { opacity: 1, y: 0 } satisfies TargetAndTransition;

const CHART_EXIT = {
  opacity: 0,
  transition: { duration: 0.12, ease: "easeIn" },
  y: -4,
} satisfies TargetAndTransition;

const CHART_TRANSITION = {
  duration: 0.2,
  ease: [0.32, 0.72, 0, 1],
} satisfies Transition;

const toLocalDate = (day: string) => {
  const [year = 1970, month = 1, date = 1] = day.split("-").map(Number);

  return new Date(year, month - 1, date);
};

const toDay = (date: Date) =>
  [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

export const AiOverviewRangePicker = ({
  data,
  onChange,
}: {
  data: AdminAiOverview;
  onChange: (search: AiOverviewSearch) => void;
}) => {
  const t = useTranslations("admin.ai.overview.range");
  const today = toLocalDate(data.today);
  const first = data.firstDay ? toLocalDate(data.firstDay) : undefined;
  const presets = AI_OVERVIEW_PRESETS.map(key => ({ key, label: t(key) }));

  return (
    <DateRangePicker<AiOverviewPreset>
      activePreset={data.range.preset}
      aria-label={t("label")}
      disabledDays={
        first ? [{ after: today }, { before: first }] : { after: today }
      }
      endMonth={today}
      onChange={({ from, to }: DateRangeValue) => {
        onChange({ from: toDay(from), to: toDay(to) });
      }}
      onPresetSelect={preset => {
        onChange(
          preset === AI_OVERVIEW_DEFAULT_PRESET ? {} : { range: preset },
        );
      }}
      presets={presets}
      startMonth={first}
      value={{
        from: toLocalDate(data.range.start),
        to: toLocalDate(data.range.end),
      }}
    />
  );
};

const MetricPicker = ({
  compareLabel,
  data,
  metric,
  onChange,
}: {
  compareLabel: string;
  data: AdminAiOverview;
  metric: AiOverviewMetric;
  onChange: (metric: AiOverviewMetric) => void;
}) => {
  const t = useTranslations("admin.ai.overview.metrics");
  const formatter = useOverviewFormat();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs" id="ai-overview-metrics">
        {t("hint", { compare: compareLabel })}
      </p>
      <div
        aria-labelledby="ai-overview-metrics"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
        role="group"
      >
        {AI_OVERVIEW_METRICS.map(key => {
          const spec = AI_METRIC_SPEC[key];
          const current = metricValue(key, data.range.totals);
          const active = key === metric;

          return (
            <button
              aria-pressed={active}
              className={cn(
                "focus-visible:ring-ring/50 flex flex-col items-start gap-1 rounded-lg border p-3 text-start transition-[background-color,border-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 active:scale-[0.96] motion-reduce:transition-none",
                active
                  ? "border-primary/40 bg-primary/5"
                  : "hover:bg-accent border-transparent",
              )}
              key={key}
              onClick={() => {
                onChange(key);
              }}
              type="button"
            >
              <span className="text-muted-foreground text-xs">{t(key)}</span>
              <span className="text-lg font-semibold tracking-tight tabular-nums">
                <SlidingNumber
                  formatter={formatter.numberFormat(spec.format, current)}
                  value={current}
                />
              </span>
              <AiDelta
                current={current}
                previous={metricValue(key, data.compare.totals)}
                tone={spec.tone}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const AiOverviewContent = ({
  data,
  describeAction,
  describeModel,
  onMonthChange,
}: {
  data: AdminAiOverview;
  describeAction: (key: string) => null | string;
  describeModel: (id: string) => null | string;
  onMonthChange: (month: string) => void;
}) => {
  const t = useTranslations("admin.ai.overview");
  const reduceMotion = useReducedMotion();
  const [metric, setMetric] = React.useState<AiOverviewMetric>("spend");
  const [interacted, setInteracted] = React.useState(false);
  const compareLabel = useCompareLabel(data);
  const metricLabel = t(`metrics.${metric}`);

  return (
    <div className="flex flex-col gap-6">
      {data.enabled ? null : (
        <Alert variant="warning">
          <AlertTitle>{t("disabled.title")}</AlertTitle>
          <AlertDescription>
            {t("disabled.desc")}{" "}
            <Link to="/admin/core/ai/settings">{t("disabled.link")}</Link>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-6">
          <AiBudgetRow data={data} onMonthChange={onMonthChange} />
          <MetricPicker
            compareLabel={compareLabel}
            data={data}
            metric={metric}
            onChange={next => {
              setMetric(next);
              setInteracted(true);
            }}
          />
          <section aria-label={metricLabel} className="min-w-0">
            <MotionFeatures>
              <AnimatePresence initial={false} mode="wait">
                <m.div
                  animate={CHART_SHOWN}
                  exit={reduceMotion ? undefined : CHART_EXIT}
                  initial={reduceMotion ? false : CHART_HIDDEN}
                  key={metric}
                  transition={CHART_TRANSITION}
                >
                  {metric === "spend" ? (
                    <AiBudgetChart data={data} entrance={interacted} />
                  ) : (
                    <AiRunningChart
                      compareLabel={compareLabel}
                      data={data}
                      entrance={interacted}
                      metric={metric}
                      metricLabel={metricLabel}
                    />
                  )}
                </m.div>
              </AnimatePresence>
            </MotionFeatures>
          </section>
        </CardContent>
      </Card>

      <AiOverviewBreakdown
        compareLabel={compareLabel}
        data={data}
        describeAction={describeAction}
        describeModel={describeModel}
        entrance={interacted}
        metric={metric}
      />
    </div>
  );
};
