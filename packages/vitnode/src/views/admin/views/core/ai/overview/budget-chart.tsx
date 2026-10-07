import { areaY, defineChart, lineY, ruleY, text } from "@tanstack/charts";
import { crosshair } from "@tanstack/charts/crosshair";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { curveMonotoneX } from "d3-shape";
import React from "react";
import { useTranslations } from "use-intl";

import { ChartContainer } from "@/components/ui/chart";
import { chartTooltipMotion } from "@/components/ui/chart-utils";
import { listAiDays, shiftAiMonth } from "@/lib/ai/overview-range";

import type { AdminAiOverview } from "../ai-query";

import {
  ChartKey,
  ChartTooltipCard,
  ClientRendererChart,
  useChartRenderer,
} from "./chart-parts";
import { useOverviewFormat } from "./overview-format";
import { cumulativeCost, usdNumber } from "./overview-metrics";

const curve = d3Curve(curveMonotoneX);
const SPEND = "var(--chart-1)";
const PREVIOUS = "var(--muted-foreground)";
const LIMIT = "var(--destructive)";

interface BurnPoint {
  day: string;
  kind: "actual" | "forecast" | "previous";
  value: number;
}

export const AiBudgetChart = ({
  data,
  entrance,
}: {
  data: AdminAiOverview;
  entrance: boolean;
}) => {
  const t = useTranslations("admin.ai.overview.chart");
  const tMetrics = useTranslations("admin.ai.overview.metrics");
  const formatter = useOverviewFormat();
  const renderer = useChartRenderer(entrance);
  const gradientId = React.useId().replace(/:/g, "");
  const { budget } = data;
  const limit = budget.limitUsd === null ? null : usdNumber(budget.limitUsd);
  const month = formatter.month(budget.month);
  const previousMonth = formatter.month(shiftAiMonth(budget.month, -1));

  const {
    actual,
    actualByDay,
    days,
    forecastByDay,
    future,
    previous,
    previousByDay,
  } = React.useMemo(() => {
    const monthDays = listAiDays(budget);
    const actualRows: BurnPoint[] = cumulativeCost(budget.days).map(point => ({
      ...point,
      kind: "actual",
    }));
    const previousRows: BurnPoint[] = cumulativeCost(budget.previousDays)
      .slice(0, monthDays.length)
      .map((point, index) => ({
        day: monthDays[index] ?? point.day,
        kind: "previous",
        value: point.value,
      }));
    const last = actualRows.at(-1);
    const remaining = monthDays.slice(actualRows.length);
    const target =
      budget.forecastUsd === null ? null : usdNumber(budget.forecastUsd);
    const step =
      last && target !== null && remaining.length > 0
        ? (target - last.value) / remaining.length
        : 0;
    const futureRows: BurnPoint[] =
      budget.live && last && target !== null
        ? [
            { ...last, kind: "forecast" },
            ...remaining.map((day, index) => ({
              day,
              kind: "forecast" as const,
              value: last.value + step * (index + 1),
            })),
          ]
        : [];

    return {
      actual: actualRows,
      actualByDay: new Map(actualRows.map(row => [row.day, row.value])),
      days: monthDays,
      forecastByDay: new Map(
        futureRows.slice(1).map(row => [row.day, row.value]),
      ),
      future: futureRows,
      previous: previousRows,
      previousByDay: new Map(
        previousRows.map((row, index) => [
          row.day,
          {
            day: budget.previousDays[index]?.day ?? row.day,
            value: row.value,
          },
        ]),
      ),
    };
  }, [budget]);

  const firstDay = days[0] ?? "";
  const tickDays = days.filter(
    (_, index) =>
      index === days.length - 1 ||
      (index % 7 === 0 && days.length - 1 - index >= 4),
  );

  const definition = React.useMemo(
    () =>
      defineChart({
        marks: [
          decorative(
            areaY(actual, {
              curve,
              fill: `url(#${gradientId})`,
              fillOpacity: 1,
              x: "day",
              y1: 0,
              y2: "value",
            }),
          ),
          crosshair({
            motion: { transition: chartTooltipMotion },
            x: { stroke: "var(--border)", strokeWidth: 1 },
            y: false,
          }),
          decorative(
            lineY(previous, {
              curve,
              stroke: PREVIOUS,
              strokeDasharray: "4 4",
              strokeWidth: 1.5,
              x: "day",
              y: "value",
            }),
          ),
          lineY(actual, {
            curve,
            stroke: SPEND,
            strokeWidth: 2,
            x: "day",
            y: "value",
          }),
          lineY(future, {
            stroke: SPEND,
            strokeDasharray: "4 5",
            strokeOpacity: 0.6,
            strokeWidth: 2,
            x: "day",
            y: "value",
          }),
          ...(limit === null
            ? []
            : [
                ruleY([limit], {
                  stroke: LIMIT,
                  strokeDasharray: "6 4",
                  strokeOpacity: 0.8,
                  strokeWidth: 1.5,
                }),
                decorative(
                  text([{ day: firstDay, value: limit }], {
                    anchor: "start",
                    dx: 4,
                    dy: -10,
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    text: () => t("limit", { limit: formatter.usdAxis(limit) }),
                    x: "day",
                    y: "value",
                  }),
                ),
              ]),
        ],
        scales: {
          x: {
            scale: scalePoint,
            axis: {
              line: false,
              ticks: { format: formatter.day, size: 0, values: tickDays },
            },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              line: false,
              ticks: { count: 4, format: formatter.usdAxis, size: 0 },
            },
          },
        },
        gradients: [
          {
            id: gradientId,
            stops: [
              { color: SPEND, offset: 0, opacity: 0.22 },
              { color: SPEND, offset: 1, opacity: 0 },
            ],
            x1: 0,
            x2: 0,
            y1: 0,
            y2: 1,
          },
        ],
        margin: { top: 16 },
        focus: "nearest-x",
        focusRing: {
          fill: SPEND,
          radius: 4,
          stroke: "var(--card)",
          strokeWidth: 2,
        },
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: {
          anchor: "point",
          motion: chartTooltipMotion,
          offset: 10,
          placement: "top",
          portal,
          use: tooltip,
        },
      }),
    [
      actual,
      firstDay,
      formatter,
      future,
      gradientId,
      limit,
      previous,
      t,
      tickDays,
    ],
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        {t("running_total", { metric: tMetrics("spend") })}
      </p>
      <ChartContainer config={{}}>
        <ClientRendererChart
          ariaDescription={t("budget_description", {
            month,
            previous: previousMonth,
          })}
          ariaLabel={t("budget_title", { month })}
          definition={definition}
          height={280}
          renderer={renderer}
          renderTooltipBody={({ primaryPoint }) => {
            if (!primaryPoint) return null;
            const { day } = primaryPoint.datum;
            const spentSoFar = actualByDay.get(day);
            const forecast = forecastByDay.get(day);
            const before = previousByDay.get(day);

            return (
              <ChartTooltipCard
                rows={[
                  ...(spentSoFar === undefined
                    ? []
                    : [
                        {
                          color: SPEND,
                          label: t("spent_so_far"),
                          value: formatter.usd(spentSoFar),
                        },
                      ]),
                  ...(forecast === undefined
                    ? []
                    : [
                        {
                          color: SPEND,
                          label: t("forecast"),
                          value: formatter.usd(forecast),
                        },
                      ]),
                  ...(before
                    ? [
                        {
                          color: PREVIOUS,
                          label: formatter.day(before.day),
                          value: formatter.usd(before.value),
                        },
                      ]
                    : []),
                  ...(limit === null
                    ? []
                    : [
                        {
                          color: LIMIT,
                          label: t("budget"),
                          value: formatter.usd(limit),
                        },
                      ]),
                ]}
                title={formatter.dayLong(day)}
              />
            );
          }}
        />
        <ChartKey
          items={[
            { color: SPEND, label: month, style: "solid" },
            ...(previous.length > 0
              ? [
                  {
                    color: PREVIOUS,
                    label: previousMonth,
                    style: "dashed" as const,
                  },
                ]
              : []),
            ...(future.length > 0
              ? [
                  {
                    color: SPEND,
                    label: t("forecast_to", { end: formatter.day(budget.end) }),
                    style: "dashed" as const,
                  },
                ]
              : []),
            ...(limit === null
              ? []
              : [
                  {
                    color: LIMIT,
                    label: t("limit", { limit: formatter.usd(limit) }),
                    style: "dashed" as const,
                  },
                ]),
          ]}
        />
      </ChartContainer>
    </div>
  );
};
