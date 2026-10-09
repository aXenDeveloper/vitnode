import { areaY, defineChart, lineY } from "@tanstack/charts";
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

import type { AdminAiOverview } from "../ai-query";
import type { AiOverviewMetric } from "./overview-metrics";

import {
  ChartKey,
  ChartTooltipCard,
  ClientRendererChart,
  useChartRenderer,
} from "./chart-parts";
import { useOverviewFormat } from "./overview-format";
import { AI_METRIC_SPEC, runningSeries } from "./overview-metrics";

const curve = d3Curve(curveMonotoneX);
const PREVIOUS = "var(--muted-foreground)";

export const AiRunningChart = ({
  compareLabel,
  data,
  entrance,
  metric,
  metricLabel,
}: {
  compareLabel: string;
  data: AdminAiOverview;
  entrance: boolean;
  metric: AiOverviewMetric;
  metricLabel: string;
}) => {
  const t = useTranslations("admin.ai.overview.chart");
  const formatter = useOverviewFormat();
  const renderer = useChartRenderer(entrance);
  const gradientId = React.useId().replace(/:/g, "");
  const spec = AI_METRIC_SPEC[metric];
  const color =
    metric === "failure_rate" ? "var(--destructive)" : "var(--chart-1)";
  const format = formatter.metric(spec.format);
  const rangeLabel = formatter.range(data.range.start, data.range.end);
  const title = spec.ratio
    ? t("running_average", { metric: metricLabel })
    : t("running_total", { metric: metricLabel });

  const { current, previous } = React.useMemo(() => {
    const series = runningSeries(metric, data.range.days, data.compare.days);

    return {
      current: series,
      previous: series.flatMap(point =>
        point.previous === null
          ? []
          : [{ day: point.day, value: point.previous }],
      ),
    };
  }, [data.compare.days, data.range.days, metric]);

  const definition = React.useMemo(
    () =>
      defineChart({
        marks: [
          decorative(
            areaY(current, {
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
          lineY(current, {
            curve,
            stroke: color,
            strokeWidth: 2,
            x: "day",
            y: "value",
          }),
        ],
        scales: {
          x: {
            scale: scalePoint,
            axis: { line: false, ticks: { format: formatter.day, size: 0 } },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              line: false,
              ticks: { count: 4, format: formatter.axis(spec.format), size: 0 },
            },
          },
        },
        gradients: [
          {
            id: gradientId,
            stops: [
              { color, offset: 0, opacity: 0.22 },
              { color, offset: 1, opacity: 0 },
            ],
            x1: 0,
            x2: 0,
            y1: 0,
            y2: 1,
          },
        ],
        focus: "nearest-x",
        focusRing: {
          fill: color,
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
    [color, current, formatter, gradientId, previous, spec.format],
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">{title}</p>
      <ChartContainer config={{}}>
        <ClientRendererChart
          ariaDescription={t("running_description", {
            compare: compareLabel,
            range: rangeLabel,
            title,
          })}
          ariaLabel={title}
          definition={definition}
          height={280}
          renderer={renderer}
          renderTooltipBody={({ primaryPoint }) => {
            if (!primaryPoint) return null;
            const point = primaryPoint.datum;

            return (
              <ChartTooltipCard
                rows={[
                  { color, label: t("so_far"), value: format(point.value) },
                  ...(point.previous !== null && point.previousDay
                    ? [
                        {
                          color: PREVIOUS,
                          label: formatter.day(point.previousDay),
                          value: format(point.previous),
                        },
                      ]
                    : []),
                ]}
                title={formatter.dayLong(point.day)}
              />
            );
          }}
        />
        <ChartKey
          items={[
            { color, label: rangeLabel, style: "solid" },
            ...(previous.length > 0
              ? [
                  {
                    color: PREVIOUS,
                    label: compareLabel,
                    style: "dashed" as const,
                  },
                ]
              : []),
          ]}
        />
      </ChartContainer>
    </div>
  );
};
