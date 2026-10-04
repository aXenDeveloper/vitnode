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
import { Area, AreaChart } from "recharts";
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

const SWAP_TRANSITION = {
  duration: 0.2,
  ease: [0.32, 0.72, 0, 1],
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

const Sparkline = ({
  animate,
  metric,
  points,
}: {
  animate: boolean;
  metric: Metric;
  points: AdminNotificationStats["points"];
}) => {
  const id = React.useId().replace(/:/g, "");
  const color = TONE[metric];
  const config = { value: { color } } satisfies ChartConfig;
  const data = points.map(point => ({ value: valueOf(point, metric) }));

  return (
    <ChartContainer
      aria-hidden
      className="aspect-auto h-10 w-full"
      config={config}
    >
      <AreaChart data={data} margin={{ bottom: 2, left: 0, right: 0, top: 2 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
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
        <Swap swapKey={`${current}:${valueOf(stats.previous, metric)}`}>
          <Delta
            current={current}
            goodWhenUp={goodWhenUp}
            previous={valueOf(stats.previous, metric)}
          />
        </Swap>
        <Sparkline animate={animate} metric={metric} points={stats.points} />
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
