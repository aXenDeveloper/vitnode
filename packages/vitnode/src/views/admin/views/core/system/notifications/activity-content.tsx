import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import {
  AnimatePresence,
  motion,
  type TargetAndTransition,
  type Transition,
  useReducedMotion,
} from "motion/react";
import React from "react";
import { createPortal } from "react-dom";
import {
  Area,
  AreaChart,
  Tooltip,
  useActiveTooltipCoordinate,
  useActiveTooltipLabel,
  useChartWidth,
  useIsTooltipActive,
  XAxis,
} from "recharts";
import { useFormatter, useTimeZone, useTranslations } from "use-intl";

import type { ChartConfig } from "@/components/ui/chart";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  AdminNotificationStats,
  NotificationStatsRange,
  NotificationStatsTotals,
} from "./notifications-query";

import {
  NOTIFICATION_STATS_RANGES,
  notificationStatsQueryOptions,
} from "./notifications-query";

type Metric = "events" | "failureRate" | "sent" | "skipped";

const isRange = (value: unknown): value is NotificationStatsRange =>
  (NOTIFICATION_STATS_RANGES as readonly unknown[]).includes(value);

const failureRate = ({ failed, sent }: NotificationStatsTotals) =>
  sent + failed === 0 ? 0 : (failed / (sent + failed)) * 100;

const valueOf = (totals: NotificationStatsTotals, metric: Metric) =>
  metric === "failureRate" ? failureRate(totals) : totals[metric];

const TONE = {
  events: "var(--chart-1)",
  failureRate: "var(--destructive)",
  sent: "var(--chart-1)",
  skipped: "var(--chart-5)",
} as const satisfies Record<Metric, string>;

const SWAP_HIDDEN = {
  filter: "blur(2px)",
  opacity: 0,
  y: 4,
} satisfies TargetAndTransition;

const SWAP_SHOWN = {
  filter: "blur(0px)",
  opacity: 1,
  y: 0,
} satisfies TargetAndTransition;

const SWAP_EXIT = {
  filter: "blur(2px)",
  opacity: 0,
  transition: { duration: 0.1, ease: "easeIn" },
  y: -4,
} satisfies TargetAndTransition;

const SNAPPY_EASE = [0.32, 0.72, 0, 1] as const;

const SWAP_TRANSITION = {
  duration: 0.2,
  ease: SNAPPY_EASE,
} satisfies Transition;

const Swap = ({
  children,
  swapKey,
}: {
  children: React.ReactNode;
  swapKey: string;
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <span className="relative block">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={SWAP_SHOWN}
          className="block"
          exit={shouldReduceMotion ? undefined : SWAP_EXIT}
          initial={shouldReduceMotion ? false : SWAP_HIDDEN}
          key={swapKey}
          transition={SWAP_TRANSITION}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

type Unit = AdminNotificationStats["unit"];

const bucketStart = (key: string) => {
  const [date = "", hour] = key.split("T");
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day, hour ? Number(hour) : 0));
};

const SparkTooltip = ({
  metric,
  point,
  unit,
}: {
  metric: Metric;
  point: AdminNotificationStats["points"][number];
  unit: Unit;
}) => {
  const t = useTranslations("admin.system.notifications.activity.tooltip");
  const format = useFormatter();
  const start = bucketStart(point.key);
  const when =
    unit === "hour"
      ? format.dateTimeRange(
          start,
          new Date(start.getTime() + 60 * 60 * 1000),
          {
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            month: "short",
            timeZone: "UTC",
          },
        )
      : format.dateTime(start, {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
          weekday: "short",
        });
  const attempted = point.sent + point.failed;
  const value =
    metric === "failureRate"
      ? attempted === 0
        ? t("failure_none")
        : t("failure", {
            failed: point.failed,
            rate: format.number(point.failed / attempted, {
              maximumFractionDigits: 1,
              style: "percent",
            }),
            total: attempted,
          })
      : t(metric, { count: point[metric] });

  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 flex w-max max-w-48 flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-xs leading-snug shadow-md ring-1">
      <span className="text-muted-foreground">{when}</span>
      <span className="flex items-center gap-1.5 font-medium tabular-nums">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: TONE[metric] }}
        />
        {value}
      </span>
    </div>
  );
};

const SparkTooltipLayer = ({
  children,
  glide,
  open,
  width,
  x,
}: {
  children: React.ReactNode;
  glide: boolean;
  open: boolean;
  width: number;
  x: number;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [size, setSize] = React.useState(0);
  const observerRef = React.useRef<null | ResizeObserver>(null);
  const measure = React.useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;
    observerRef.current = new ResizeObserver(([entry]) => {
      setSize(entry?.borderBoxSize[0]?.inlineSize ?? node.offsetWidth);
    });
    observerRef.current.observe(node);
  }, []);
  const left = Math.min(Math.max(x - size / 2, 0), Math.max(width - size, 0));

  return (
    <motion.div
      animate={{
        opacity: open ? 1 : 0,
        scale: open ? 1 : 0.97,
        x: left,
        y: open ? 0 : 2,
      }}
      aria-hidden={!open}
      className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 origin-bottom"
      initial={
        shouldReduceMotion ? false : { opacity: 0, scale: 0.97, x: left, y: 2 }
      }
      ref={measure}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              default: open
                ? { duration: 0.15, ease: SNAPPY_EASE }
                : { duration: 0.1, ease: "easeIn" },
              x: glide
                ? { duration: 0.14, ease: SNAPPY_EASE }
                : { duration: 0 },
            }
      }
    >
      {children}
    </motion.div>
  );
};

const SparkTooltipPortal = ({
  container,
  glideAllowed,
  metric,
  points,
  unit,
}: {
  container: HTMLDivElement | null;
  glideAllowed: boolean;
  metric: Metric;
  points: AdminNotificationStats["points"];
  unit: Unit;
}) => {
  const active = useIsTooltipActive();
  const label = useActiveTooltipLabel();
  const x = useActiveTooltipCoordinate()?.x;
  const width = useChartWidth() ?? 0;
  const key = typeof label === "string" ? label : undefined;
  const open = active && key !== undefined;
  const [shown, setShown] = React.useState({
    glide: false,
    key: undefined as string | undefined,
    open: false,
    x: 0,
  });

  if (
    open !== shown.open ||
    (key !== undefined && key !== shown.key) ||
    (x !== undefined && x !== shown.x)
  ) {
    setShown({
      glide: shown.open && open,
      key: key ?? shown.key,
      open,
      x: x ?? shown.x,
    });
  }

  const point = points.find(item => item.key === shown.key);
  if (!container || !point) return null;

  return createPortal(
    <SparkTooltipLayer
      glide={shown.glide && glideAllowed}
      open={shown.open}
      width={width}
      x={shown.x}
    >
      <SparkTooltip metric={metric} point={point} unit={unit} />
    </SparkTooltipLayer>,
    container,
  );
};

const Sparkline = ({
  animate,
  label,
  metric,
  points,
  unit,
}: {
  animate: boolean;
  label: string;
  metric: Metric;
  points: AdminNotificationStats["points"];
  unit: Unit;
}) => {
  const t = useTranslations("admin.system.notifications.activity");
  const id = React.useId().replace(/:/g, "");
  const [input, setInput] = React.useState<"keyboard" | "pointer">("pointer");
  const [layer, setLayer] = React.useState<HTMLDivElement | null>(null);
  const color = TONE[metric];
  const config = { value: { color } } satisfies ChartConfig;
  const data = points.map(point => ({
    key: point.key,
    value: valueOf(point, metric),
  }));

  return (
    <div className="relative" ref={setLayer}>
      <ChartContainer
        className="aspect-auto h-10 w-full"
        config={config}
        onKeyDown={() => {
          setInput("keyboard");
        }}
        onPointerMove={() => {
          setInput("pointer");
        }}
      >
        <AreaChart
          data={data}
          margin={{ bottom: 2, left: 0, right: 0, top: 2 }}
          title={t("trend", { label })}
        >
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="key" hide />
          <Tooltip
            content={() => null}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <SparkTooltipPortal
            container={layer}
            glideAllowed={input === "pointer"}
            metric={metric}
            points={points}
            unit={unit}
          />
          <Area
            activeDot={{
              fill: color,
              r: 3,
              stroke: "var(--card)",
              strokeWidth: 2,
            }}
            animationDuration={300}
            animationEasing="ease-out"
            dataKey="value"
            fill={`url(#spark-${id})`}
            isAnimationActive={animate}
            stroke={color}
            strokeWidth={1.5}
            type="monotone"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
};

const Delta = ({
  current,
  goodWhenUp,
  previous,
}: {
  current: number;
  goodWhenUp: boolean;
  previous: number;
}) => {
  const t = useTranslations("admin.system.notifications.activity");
  const format = useFormatter();

  if (previous === 0) {
    return (
      <span className="text-muted-foreground text-xs">{t("no_previous")}</span>
    );
  }

  const change = (current - previous) / previous;
  const up = change >= 0;
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-medium tabular-nums",
        up === goodWhenUp ? "text-success" : "text-destructive",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {format.number(Math.abs(change), {
        maximumFractionDigits: 1,
        style: "percent",
      })}
      <span className="text-muted-foreground font-normal">
        {t("vs_previous")}
      </span>
    </span>
  );
};

const StatTile = ({
  animate,
  goodWhenUp,
  label,
  metric,
  stats,
}: {
  animate: boolean;
  goodWhenUp: boolean;
  label: string;
  metric: Metric;
  stats: AdminNotificationStats;
}) => {
  const format = useFormatter();
  const current = valueOf(stats.totals, metric);
  const previous = valueOf(stats.previous, metric);
  const value =
    metric === "failureRate"
      ? format.number(current / 100, {
          maximumFractionDigits: 2,
          style: "percent",
        })
      : format.number(current);

  return (
    <Card className="gap-2 py-4" size="sm">
      <CardContent className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          <Swap swapKey={value}>{value}</Swap>
        </p>
        <Swap swapKey={`${current}:${previous}`}>
          <Delta
            current={current}
            goodWhenUp={goodWhenUp}
            previous={previous}
          />
        </Swap>
        <Sparkline
          animate={animate}
          label={label}
          metric={metric}
          points={stats.points}
          unit={stats.unit}
        />
      </CardContent>
    </Card>
  );
};

const TilesSkeleton = () => (
  <div aria-hidden className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {["a", "b", "c", "d"].map(key => (
      <Skeleton className="h-36 rounded-xl" key={key} />
    ))}
  </div>
);

export const NotificationsActivity = () => {
  const t = useTranslations("admin.system.notifications.activity");
  const tPage = useTranslations("admin.system.notifications.load_error");
  const tError = useTranslations("core.global.errors");
  const timeZone = useTimeZone() ?? "UTC";
  const [range, setRange] = React.useState<NotificationStatsRange>("7d");
  const [hasSwitched, setHasSwitched] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();
  const animate = hasSwitched && !shouldReduceMotion;
  const query = useQuery({
    ...notificationStatsQueryOptions({ range, timeZone }),
    placeholderData: keepPreviousData,
  });

  return (
    <section
      aria-labelledby="notifications-activity"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            className="text-lg font-semibold text-balance"
            id="notifications-activity"
          >
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t(`ranges.${range}`)}
          </p>
        </div>
        <Tabs
          onValueChange={value => {
            if (!isRange(value)) return;
            setRange(value);
            setHasSwitched(true);
          }}
          value={range}
        >
          <TabsList aria-label={t("range_label")}>
            {NOTIFICATION_STATS_RANGES.map(key => (
              <TabsTrigger
                aria-label={t(`ranges.${key}`)}
                key={key}
                value={key}
              >
                {t(`ranges_short.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {query.data ? (
        <div
          aria-busy={query.isFetching}
          className={cn(
            "grid grid-cols-2 gap-3 transition-opacity duration-150 ease-out motion-reduce:transition-none lg:grid-cols-4",
            query.isPlaceholderData && "opacity-60",
          )}
        >
          <StatTile
            animate={animate}
            goodWhenUp
            label={t("sent")}
            metric="sent"
            stats={query.data}
          />
          <StatTile
            animate={animate}
            goodWhenUp={false}
            label={t("failure_rate")}
            metric="failureRate"
            stats={query.data}
          />
          <StatTile
            animate={animate}
            goodWhenUp
            label={t("events")}
            metric="events"
            stats={query.data}
          />
          <StatTile
            animate={animate}
            goodWhenUp={false}
            label={t("skipped")}
            metric="skipped"
            stats={query.data}
          />
        </div>
      ) : query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{tPage("title")}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <p>{tPage("desc")}</p>
            <Button
              onClick={() => {
                void query.refetch();
              }}
              size="sm"
              variant="outline"
            >
              {tError("try_again")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <TilesSkeleton />
      )}
    </section>
  );
};
