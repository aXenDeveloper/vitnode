import { barX, defineChart, tickX } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Link } from "@tanstack/react-router";
import React from "react";
import { useTranslations } from "use-intl";

import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { chartTooltipMotion } from "@/components/ui/chart-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { AdminAiOverview } from "../ai-query";
import type { AiOverviewMetric } from "./overview-metrics";

import { AiActionLabel } from "../ai-labels";
import {
  AiDelta,
  ChartKey,
  ChartTooltipCard,
  ClientRendererChart,
  useChartRenderer,
} from "./chart-parts";
import { useOverviewFormat } from "./overview-format";
import { AI_METRIC_SPEC, measureValue } from "./overview-metrics";

type Split = "action" | "model";

const isSplit = (value: unknown): value is Split =>
  value === "action" || value === "model";

const CHART_ROWS = 8;
const BAR = "var(--chart-1)";
const TICK = "var(--foreground)";

const clip = (label: string) =>
  label.length > 32 ? `${label.slice(0, 31)}…` : label;

export const AiOverviewBreakdown = ({
  compareLabel,
  data,
  describeAction,
  describeModel,
  entrance,
  metric,
}: {
  compareLabel: string;
  data: AdminAiOverview;
  describeAction: (key: string) => null | string;
  describeModel: (id: string) => null | string;
  entrance: boolean;
  metric: AiOverviewMetric;
}) => {
  const t = useTranslations("admin.ai.overview.breakdown");
  const tMeasure = useTranslations("admin.ai.overview.measure");
  const tCost = useTranslations("admin.ai.cost");
  const formatter = useOverviewFormat();
  const [split, setSplit] = React.useState<Split>("action");
  const [splitChanged, setSplitChanged] = React.useState(false);
  const renderer = useChartRenderer(entrance || splitChanged);
  const measure = AI_METRIC_SPEC[metric].measure;
  const kind =
    measure === "cost" ? "usd" : measure === "tokens" ? "tokens" : "count";
  const format = formatter.metric(kind);
  const axis = formatter.axis(kind);
  const tone = measure === "failures" ? "down-good" : "neutral";

  const entities = React.useMemo(
    () =>
      (split === "action" ? data.byAction : data.byModel)
        .map(entity => ({
          key: entity.key,
          label:
            (split === "action"
              ? describeAction(entity.key)
              : describeModel(entity.key)) ?? entity.key,
          previous: measureValue(measure, entity.previous),
          unknown:
            measure === "cost" &&
            entity.current.operations > 0 &&
            entity.current.knownOperations === 0,
          value: measureValue(measure, entity.current),
        }))
        .filter(
          entity => entity.value > 0 || entity.previous > 0 || entity.unknown,
        )
        .sort((a, b) => b.value - a.value || b.previous - a.previous),
    [
      data.byAction,
      data.byModel,
      describeAction,
      describeModel,
      measure,
      split,
    ],
  );

  const unpriced =
    measure === "cost"
      ? data.range.totals.operations - data.range.totals.knownOperations
      : 0;

  const chartRows = React.useMemo(() => {
    const top = entities.slice(0, CHART_ROWS);
    const rest = entities.slice(CHART_ROWS);
    const rows = top.map(entity => ({ ...entity, name: clip(entity.label) }));
    if (rest.length === 0) return rows;

    return [
      ...rows,
      {
        key: "other",
        label: t("other", { count: rest.length }),
        name: t("other", { count: rest.length }),
        previous: rest.reduce((sum, entity) => sum + entity.previous, 0),
        unknown: false,
        value: rest.reduce((sum, entity) => sum + entity.value, 0),
      },
    ];
  }, [entities, t]);

  const definition = React.useMemo(
    () =>
      defineChart({
        marks: [
          barX(chartRows, {
            fill: BAR,
            maxThickness: 22,
            radius: 4,
            x: "value",
            y: "name",
          }),
          tickX(chartRows, {
            stroke: TICK,
            strokeWidth: 2,
            x: "previous",
            y: "name",
          }),
        ],
        scales: {
          x: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { line: false, ticks: { count: 4, format: axis, size: 0 } },
          },
          y: {
            scale: () => scaleBand().padding(0.35),
            axis: { line: false, ticks: { size: 0 } },
          },
        },
        focus: "group-y",
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: { motion: chartTooltipMotion, portal, use: tooltip },
      }),
    [axis, chartRows],
  );

  return (
    <section
      aria-labelledby="ai-overview-breakdown"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-lg font-semibold text-balance"
          id="ai-overview-breakdown"
        >
          {t("title")}
        </h2>
        <Tabs
          onValueChange={value => {
            if (!isSplit(value)) return;
            setSplit(value);
            setSplitChanged(true);
          }}
          value={split}
        >
          <TabsList aria-label={t("split")}>
            <TabsTrigger value="action">{t("by_action")}</TabsTrigger>
            <TabsTrigger value="model">{t("by_model")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-6">
          {chartRows.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {t("empty")}
            </p>
          ) : (
            <ChartContainer config={{}} key={`${split}:${measure}`}>
              <ClientRendererChart
                ariaDescription={t("chart_description", {
                  compare: compareLabel,
                  measure: tMeasure(measure),
                })}
                ariaLabel={t("chart_label", { measure: tMeasure(measure) })}
                definition={definition}
                height={Math.max(chartRows.length * 44 + 40, 160)}
                renderer={renderer}
                renderTooltipBody={({ primaryPoint }) => {
                  if (!primaryPoint) return null;
                  const row = primaryPoint.datum;

                  return (
                    <ChartTooltipCard
                      rows={[
                        {
                          color: BAR,
                          label: t("now"),
                          value: row.unknown
                            ? tCost("unknown")
                            : format(row.value),
                        },
                        {
                          color: TICK,
                          label: compareLabel,
                          value: format(row.previous),
                        },
                      ]}
                      title={row.label}
                    />
                  );
                }}
              />
              <ChartKey
                items={[
                  { color: BAR, label: t("now"), style: "solid" },
                  { color: TICK, label: t("tick"), style: "dashed" },
                ]}
              />
            </ChartContainer>
          )}

          {unpriced > 0 ? (
            <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
              {t("unpriced", { count: unpriced })}{" "}
              <Link
                className="text-foreground underline underline-offset-3"
                to="/admin/core/ai/actions"
              >
                {t("add_price")}
              </Link>
            </p>
          ) : null}

          {entities.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {split === "action" ? t("action") : t("model")}
                  </TableHead>
                  <TableHead className="text-end">
                    {tMeasure(measure)}
                  </TableHead>
                  <TableHead className="hidden text-end sm:table-cell">
                    {t("change", { compare: compareLabel })}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map(entity => {
                  const delta = entity.unknown ? (
                    <span className="text-muted-foreground text-xs">—</span>
                  ) : (
                    <AiDelta
                      current={entity.value}
                      previous={entity.previous}
                      tone={tone}
                    />
                  );

                  return (
                    <TableRow key={entity.key}>
                      <TableCell className="max-w-44 whitespace-normal sm:max-w-96">
                        <AiActionLabel
                          actionKey={entity.key}
                          title={
                            split === "action"
                              ? describeAction(entity.key)
                              : describeModel(entity.key)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-end align-top tabular-nums">
                        {entity.unknown ? (
                          <span className="text-muted-foreground italic">
                            {tCost("unknown")}
                          </span>
                        ) : (
                          <span className="flex flex-col items-end gap-0.5">
                            {format(entity.value)}
                            <span className="sm:hidden">{delta}</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-end align-top sm:table-cell">
                        <span className="inline-flex justify-end">{delta}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
};
