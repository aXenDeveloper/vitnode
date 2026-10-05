import type {
  ChartColorOptions,
  ChartPoint,
  ChartTooltipBodyContext,
} from "@tanstack/charts";

import { cn } from "cn";
import React from "react";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = Record<
  string,
  (
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
    | { color?: string; theme?: never }
  ) & {
    icon?: React.ComponentType;
    label?: React.ReactNode;
  }
>;

interface ChartContextProps {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.use(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

// TanStack Charts reads these tokens from the closest ancestor.
const CHART_THEME = {
  "--ts-chart-1": "var(--chart-1)",
  "--ts-chart-2": "var(--chart-2)",
  "--ts-chart-3": "var(--chart-3)",
  "--ts-chart-4": "var(--chart-4)",
  "--ts-chart-5": "var(--chart-5)",
  "--ts-chart-6": "var(--muted-foreground)",
  "--ts-chart-focus-fill": "var(--background)",
  "--ts-chart-crosshair-marker-fill": "var(--background)",
  "--ts-chart-tooltip-background": "var(--popover)",
  "--ts-chart-tooltip-color": "var(--popover-foreground)",
  "--ts-chart-tooltip-border":
    "1px solid color-mix(in oklab, var(--border) 50%, transparent)",
  "--ts-chart-tooltip-border-radius": "var(--radius-lg)",
  "--ts-chart-tooltip-shadow":
    "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "--ts-chart-tooltip-padding": "0.375rem 0.625rem",
  "--ts-chart-tooltip-font": "inherit",
  "--ts-chart-tooltip-active-row-background": "transparent",
  "--ts-chart-tooltip-active-row-shadow": "none",
} as React.CSSProperties;

function ChartContainer({
  id,
  className,
  children,
  config,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn(
          "text-muted-foreground flex w-full flex-col gap-3 text-xs tabular-nums [&_.ts-chart]:outline-hidden",
          className,
        )}
        data-chart={chartId}
        data-slot="chart"
        style={{ ...CHART_THEME, ...style }}
        {...props}
      >
        <ChartStyle config={config} id={chartId} />
        {children}
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { config: ChartConfig; id: string }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme ?? config.color,
  );

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ??
      itemConfig.color;

    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`,
          )
          .join("\n"),
      }}
    />
  );
};

const colorKeys = (config: ChartConfig) =>
  Object.entries(config)
    .filter(([, item]) => item.theme ?? item.color)
    .map(([key]) => key);

/**
 * Maps every colored config key to its `--color-<key>` variable, so a mark's
 * `color` channel paints series with the colors from your config.
 */
function chartColor(config: ChartConfig): ChartColorOptions {
  const domain = colorKeys(config);

  return { domain, range: domain.map(key => `var(--color-${key})`) };
}

const readField = (datum: unknown, key: string): unknown =>
  typeof datum === "object" && datum !== null && key in datum
    ? (datum as Record<string, unknown>)[key]
    : undefined;

// A field that holds a string names a config key, anything else falls back to the key itself.
const configKey = (datum: unknown, key: string) => {
  const value = readField(datum, key);

  return typeof value === "string" ? value : key;
};

const formatValue = (value: unknown) => {
  if (typeof value === "number") return value.toLocaleString();
  if (value instanceof Date) return value.toLocaleDateString();

  return typeof value === "string" ? value : "";
};

function ChartTooltipContent({
  points,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
  valueKey,
}: Pick<ChartTooltipBodyContext, "points"> & {
  className?: string;
  color?: string;
  formatter?: (
    value: unknown,
    name: React.ReactNode,
    point: ChartPoint,
    index: number,
  ) => React.ReactNode;
  hideIndicator?: boolean;
  hideLabel?: boolean;
  indicator?: "dashed" | "dot" | "line";
  labelClassName?: string;
  labelFormatter?: (
    label: React.ReactNode,
    points: readonly ChartPoint[],
  ) => React.ReactNode;
  labelKey?: string;
  nameKey?: string;
  valueKey?: string;
}) {
  const { config } = useChart();

  if (!points.length) {
    return null;
  }

  const tooltipLabel = (() => {
    if (hideLabel) {
      return null;
    }

    const [point] = points;
    const raw = labelKey ? readField(point?.datum, labelKey) : point?.xValue;
    const value =
      (typeof raw === "string" ? config[raw]?.label : undefined) ??
      formatValue(raw);

    if (labelFormatter) {
      return (
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, points)}
        </div>
      );
    }

    if (!value) {
      return null;
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>;
  })();

  const nestLabel = points.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 text-xs leading-snug",
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {points.map((point, index) => {
          const key = nameKey
            ? configKey(point.datum, nameKey)
            : point.group === null
              ? undefined
              : point.groupLabel;
          const itemConfig = key ? config[key] : undefined;
          const name = itemConfig?.label ?? key;
          const value = valueKey
            ? readField(point.datum, valueKey)
            : point.yValue;
          const indicatorColor = color ?? point.color;

          return (
            <div
              className={cn(
                "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5",
                indicator === "dot" && "items-center",
              )}
              key={point.key}
            >
              {formatter ? (
                formatter(value, name, point, index)
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn(
                          "shrink-0 rounded-xs border-(--color-border) bg-(--color-bg)",
                          {
                            "size-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent":
                              indicator === "dashed",
                            "my-0.5": nestLabel && indicator === "dashed",
                          },
                        )}
                        style={
                          {
                            "--color-bg": indicatorColor,
                            "--color-border": indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}
                  <div
                    className={cn(
                      "flex flex-1 justify-between gap-4 leading-none",
                      nestLabel ? "items-end" : "items-center",
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      {name ? (
                        <span className="text-muted-foreground">{name}</span>
                      ) : null}
                    </div>
                    {value != null && (
                      <span className="text-foreground font-medium tabular-nums">
                        {formatValue(value)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartLegend({
  className,
  hideIcon = false,
  keys,
  ...props
}: React.ComponentProps<"ul"> & {
  hideIcon?: boolean;
  keys?: readonly string[];
}) {
  const { config } = useChart();
  const items = keys ?? colorKeys(config);

  if (!items.length) {
    return null;
  }

  return (
    <ul
      className={cn(
        "flex flex-wrap items-center justify-center gap-4",
        className,
      )}
      data-slot="chart-legend"
      {...props}
    >
      {items.map(key => {
        const itemConfig = config[key];

        return (
          <li
            className="[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:size-3"
            key={key}
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-xs"
                style={{ backgroundColor: `var(--color-${key})` }}
              />
            )}
            {itemConfig?.label ?? key}
          </li>
        );
      })}
    </ul>
  );
}

export {
  chartColor,
  ChartContainer,
  ChartLegend,
  ChartStyle,
  ChartTooltipContent,
};
