import type { ChartValue } from "@tanstack/charts";
import type { RendererChartProps } from "@tanstack/charts/react/tooltip";

import { motion as chartMotion } from "@tanstack/charts/motion";
import { RendererChart } from "@tanstack/charts/react/tooltip";
import { cn } from "cn";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import { cubicBezier, useReducedMotion } from "motion/react";
import React from "react";
import { useTranslations } from "use-intl";

import type { AiDeltaTone } from "./overview-metrics";

import { useOverviewFormat } from "./overview-format";

export const useChartRenderer = (entrance = false) => {
  const reduced = useReducedMotion();
  const draw = entrance && !reduced;

  return React.useMemo(
    () =>
      chartMotion({
        initial: draw,
        transition: {
          duration: reduced ? 0 : draw ? 450 : 250,
          easing: draw
            ? cubicBezier(0.32, 0.72, 0, 1)
            : cubicBezier(0.45, 0, 0.55, 1),
          type: "tween",
        },
      }),
    [draw, reduced],
  );
};

const subscribeNever = () => () => undefined;

export const ClientRendererChart = <
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  props: RendererChartProps<TDatum, TXValue, TYValue>,
) => {
  const hydrated = React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  if (!hydrated) {
    return <div aria-hidden="true" style={{ height: props.height }} />;
  }

  return <RendererChart {...props} />;
};

export interface ChartKeyItem {
  color: string;
  label: string;
  style: "dashed" | "solid";
}

export const ChartKey = ({ items }: { items: ChartKeyItem[] }) => (
  <ul className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
    {items.map(item => (
      <li className="flex items-center gap-1.5" key={item.label}>
        {item.style === "dashed" ? (
          <span
            aria-hidden
            className="w-3.5 border-t-2 border-dashed"
            style={{ borderColor: item.color }}
          />
        ) : (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-xs"
            style={{ backgroundColor: item.color }}
          />
        )}
        {item.label}
      </li>
    ))}
  </ul>
);

export const ChartTooltipCard = ({
  rows,
  title,
}: {
  rows: { color: string; label: string; value: string }[];
  title: string;
}) => (
  <div className="grid min-w-40 gap-1.5 text-xs leading-snug">
    <span className="font-medium">{title}</span>
    {rows.map(row => (
      <span className="flex items-center gap-2" key={row.label}>
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-xs"
          style={{ backgroundColor: row.color }}
        />
        <span className="text-muted-foreground max-w-48 truncate">
          {row.label}
        </span>
        <span className="text-foreground ms-auto ps-3 font-medium tabular-nums">
          {row.value}
        </span>
      </span>
    ))}
  </div>
);

export const AiDelta = ({
  current,
  previous,
  tone,
}: {
  current: number;
  previous: number;
  tone: AiDeltaTone;
}) => {
  const t = useTranslations("admin.ai.overview.delta");
  const formatter = useOverviewFormat();

  if (previous === 0) {
    return (
      <span className="text-muted-foreground text-xs">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("no_previous")}</span>
      </span>
    );
  }

  const change = (current - previous) / previous;

  if (Math.abs(change) < 0.0005) {
    return (
      <span className="text-muted-foreground text-xs font-medium">
        {t("no_change")}
      </span>
    );
  }

  const up = change > 0;
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  const good = tone === "neutral" ? null : up === (tone === "up-good");

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-medium tabular-nums",
        good === null && "text-foreground",
        good === true && "text-success",
        good === false && "text-destructive",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="sr-only">{up ? t("up") : t("down")}</span>
      {formatter.percent(Math.abs(change))}
    </span>
  );
};
