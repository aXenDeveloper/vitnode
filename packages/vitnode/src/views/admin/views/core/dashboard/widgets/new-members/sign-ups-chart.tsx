import { cn } from "cn";
import { animate, type AnimationPlaybackControls } from "motion";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";

import type { AdminSignUps, SignUpRange } from "./sign-ups-query";

const SAMPLES = 6 * 13 * 29 + 1;
const HEADROOM = 1.1;
const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT_CUBIC = [0.645, 0.045, 0.355, 1] as const;
const ENTRANCE_S = 0.5;
const MORPH_S = 0.3;

type SignUpDay = AdminSignUps["days"][number];

interface Shape {
  current: Float64Array;
  previous: Float64Array;
}

const resample = (values: number[], max: number): Float64Array => {
  const last = values.length - 1;
  const out = new Float64Array(SAMPLES);
  for (let sample = 0; sample < SAMPLES; sample++) {
    const position = (sample / (SAMPLES - 1)) * last;
    const low = Math.floor(position);
    const high = Math.min(last, low + 1);
    const mix = position - low;
    out[sample] =
      ((values[low] ?? 0) * (1 - mix) + (values[high] ?? 0) * mix) /
      (max * HEADROOM);
  }

  return out;
};

const linePath = (shape: Float64Array): string => {
  let d = "";
  for (let sample = 0; sample < SAMPLES; sample++) {
    const x = (sample / (SAMPLES - 1)) * 100;
    const y = 100 - (shape[sample] ?? 0) * 100;
    d += `${sample === 0 ? "M" : "L"}${x.toFixed(3)},${y.toFixed(3)}`;
  }

  return d;
};

const areaPath = (shape: Float64Array): string =>
  `${linePath(shape)}L100,100L0,100Z`;

const useMorphingPaths = (current: number[], previous: number[]) => {
  const reduceMotion = useReducedMotion();
  const areaRef = React.useRef<SVGPathElement>(null);
  const lineRef = React.useRef<SVGPathElement>(null);
  const previousRef = React.useRef<SVGPathElement>(null);
  const max = Math.max(1, ...current, ...previous);
  const target = React.useMemo<Shape>(
    () => ({
      current: resample(current, max),
      previous: resample(previous, max),
    }),
    [current, previous, max],
  );
  const [initial] = React.useState(() => ({
    area: areaPath(target.current),
    line: linePath(target.current),
    previous: linePath(target.previous),
  }));
  const shown = React.useRef<Shape>(target);

  const paint = React.useCallback((shape: Shape) => {
    areaRef.current?.setAttribute("d", areaPath(shape.current));
    lineRef.current?.setAttribute("d", linePath(shape.current));
    previousRef.current?.setAttribute("d", linePath(shape.previous));
  }, []);

  React.useLayoutEffect(() => {
    const from = shown.current;
    if (from === target) return;
    if (reduceMotion) {
      shown.current = target;
      paint(target);

      return;
    }

    const mixed: Shape = {
      current: new Float64Array(SAMPLES),
      previous: new Float64Array(SAMPLES),
    };
    paint(from);
    const playback: AnimationPlaybackControls = animate(0, 1, {
      duration: MORPH_S,
      ease: EASE_IN_OUT_CUBIC,
      onUpdate: progress => {
        for (let sample = 0; sample < SAMPLES; sample++) {
          const currentFrom = from.current[sample] ?? 0;
          const previousFrom = from.previous[sample] ?? 0;
          mixed.current[sample] =
            currentFrom +
            ((target.current[sample] ?? 0) - currentFrom) * progress;
          mixed.previous[sample] =
            previousFrom +
            ((target.previous[sample] ?? 0) - previousFrom) * progress;
        }
        paint(mixed);
        shown.current = {
          current: Float64Array.from(mixed.current),
          previous: Float64Array.from(mixed.previous),
        };
      },
    });

    return () => {
      playback.stop();
    };
  }, [paint, reduceMotion, target]);

  return { areaRef, initial, lineRef, max, previousRef };
};

const GLIDE =
  "transition-transform duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";

export const SignUpsChart = ({
  current,
  days,
  previous,
}: {
  current: SignUpDay[];
  days: SignUpRange;
  previous: SignUpDay[];
}) => {
  const t = useTranslations("admin.dashboard.widgets.new-members");
  const format = useFormatter();
  const reduceMotion = useReducedMotion();
  const currentValues = React.useMemo(
    () => current.map(entry => entry.count),
    [current],
  );
  const previousValues = React.useMemo(
    () => previous.map(entry => entry.count),
    [previous],
  );
  const { areaRef, initial, lineRef, max, previousRef } = useMorphingPaths(
    currentValues,
    previousValues,
  );
  const [hover, setHover] = React.useState<null | number>(null);
  const [lastHover, setLastHover] = React.useState(0);
  const [instant, setInstant] = React.useState(true);
  const count = current.length;
  const index = Math.min(hover ?? lastHover, count - 1);
  const x = (at: number) => (at / Math.max(1, count - 1)) * 100;
  const y = (value: number) => 100 - (value / (max * HEADROOM)) * 100;
  const half = 50 / Math.max(1, count - 1);
  const dayLabel = (day: string) =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      weekday: "short",
    });

  const show = (at: number, byPointer: boolean) => {
    setInstant(!byPointer || hover === null);
    setHover(at);
    setLastHover(at);
  };

  const shownDay = current[index];
  const shownPrevious = previous[index];
  const difference =
    shownDay && shownPrevious ? shownDay.count - shownPrevious.count : 0;

  return (
    <div className="relative h-28">
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <path
          className="text-muted-foreground"
          d={initial.previous}
          fill="none"
          ref={previousRef}
          stroke="currentColor"
          strokeDasharray="4 4"
          strokeLinejoin="round"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <MotionFeatures>
        <m.div
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          className="absolute inset-0"
          initial={reduceMotion ? false : { clipPath: "inset(0 100% 0 0)" }}
          transition={{ duration: ENTRANCE_S, ease: EASE_OUT_QUINT }}
        >
          <svg
            aria-hidden="true"
            className="size-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <path className="fill-primary/10" d={initial.area} ref={areaRef} />
            <path
              className="text-primary"
              d={initial.line}
              fill="none"
              ref={lineRef}
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </m.div>
      </MotionFeatures>

      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-150 motion-reduce:transition-none",
          hover === null ? "opacity-0" : "opacity-100",
        )}
      >
        <span
          className={cn("absolute inset-0", !instant && GLIDE)}
          style={{ transform: `translateX(${x(index)}%)` }}
        >
          <span className="bg-foreground/15 absolute inset-y-0 start-0 w-px" />
        </span>
        <span
          className={cn("absolute inset-0", !instant && GLIDE)}
          style={{
            transform: `translate(${x(index)}%, ${y(previousValues[index] ?? 0)}%)`,
          }}
        >
          <span className="border-muted-foreground bg-card absolute start-0 top-0 size-2 -translate-1/2 rounded-full border-2" />
        </span>
        <span
          className={cn("absolute inset-0", !instant && GLIDE)}
          style={{
            transform: `translate(${x(index)}%, ${y(currentValues[index] ?? 0)}%)`,
          }}
        >
          <span className="bg-primary ring-card absolute start-0 top-0 size-2.5 -translate-1/2 rounded-full ring-2" />
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 mb-2">
        <div
          className={cn(!instant && GLIDE)}
          style={{ transform: `translateX(${x(index)}%)` }}
        >
          <div
            className={cn("w-max", !instant && GLIDE)}
            style={{
              transform: `translateX(${-(index / Math.max(1, count - 1)) * 100}%)`,
            }}
          >
            <div
              className={cn(
                "bg-popover text-popover-foreground ring-foreground/10 flex min-w-44 flex-col gap-1.5 rounded-md px-3 py-2 text-xs shadow-md ring-1",
                "transition-[opacity,translate] motion-reduce:transition-none",
                hover === null
                  ? "translate-y-1 opacity-0 duration-100 ease-in"
                  : "translate-y-0 opacity-100 duration-150 ease-out",
              )}
            >
              {shownDay ? (
                <>
                  <span className="font-medium">{dayLabel(shownDay.day)}</span>
                  <span className="flex items-center gap-2">
                    <span className="bg-primary h-0.5 w-3 shrink-0 rounded-full" />
                    <span className="text-muted-foreground flex-1">
                      {t("current", { days })}
                    </span>
                    <span className="font-medium tabular-nums">
                      {format.number(shownDay.count)}
                    </span>
                  </span>
                  {shownPrevious ? (
                    <span className="flex items-center gap-2">
                      <span className="border-muted-foreground w-3 shrink-0 border-t-2 border-dashed" />
                      <span className="text-muted-foreground flex-1">
                        {dayLabel(shownPrevious.day)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {format.number(shownPrevious.count)}
                      </span>
                    </span>
                  ) : null}
                  {difference === 0 ? null : (
                    <span
                      className={cn(
                        "border-border border-t pt-1.5 tabular-nums",
                        difference > 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {difference > 0
                        ? t("more", { count: difference })
                        : t("fewer", { count: Math.abs(difference) })}
                    </span>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div
        aria-label={t("chart", { days })}
        className="absolute inset-0"
        onPointerLeave={() => setHover(null)}
        role="group"
      >
        {current.map((entry, at) => {
          const before = previous[at];

          return (
            <button
              aria-label={t("point", {
                count: entry.count,
                date: dayLabel(entry.day),
                previous: before?.count ?? 0,
                previousDate: before ? dayLabel(before.day) : "",
              })}
              className="focus-visible:ring-ring absolute inset-y-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-inset"
              key={entry.day}
              onBlur={() => setHover(null)}
              onFocus={() => show(at, false)}
              onPointerEnter={() => show(at, true)}
              style={{ left: `${x(at) - half}%`, width: `${half * 2}%` }}
              type="button"
            />
          );
        })}
      </div>
    </div>
  );
};
