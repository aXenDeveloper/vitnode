import { cn } from "cn";
import { CalendarClockIcon } from "lucide-react";
import React from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { SlidingNumber } from "@/components/ui/sliding-number";

import { countdownParts } from "./countdown-parts";

const TICK_MS = 1000;

const subscribeToClock = (onTick: () => void) => {
  const interval = window.setInterval(onTick, TICK_MS);
  document.addEventListener("visibilitychange", onTick);

  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onTick);
  };
};

const toSecond = (ms: number) => Math.floor(ms / TICK_MS) * TICK_MS;

/**
 * The current time, ticking once a second and corrected by `offsetMs`. During
 * SSR and hydration it is `serverNowMs`, so the first paint already shows the
 * right digits and the markup matches.
 */
const useServerClock = (serverNowMs: number, offsetMs: number): number => {
  const getSnapshot = React.useCallback(
    () => toSecond(Date.now() + offsetMs),
    [offsetMs],
  );

  return React.useSyncExternalStore(subscribeToClock, getSnapshot, () =>
    toSecond(serverNowMs),
  );
};

const UNITS = ["days", "hours", "minutes", "seconds"] as const;

const OpensAtDate = ({ opensAt }: { opensAt: string }) => {
  const format = useFormatter();

  return (
    <time dateTime={opensAt}>
      {format.dateTime(new Date(opensAt), {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </time>
  );
};

/**
 * When the site opens, as a compact row: a live countdown with rolling
 * digits and the date, or (with `showCountdown` off) the date alone. Once the
 * time has passed it shows "Opening soon" - it never opens anything by
 * itself.
 */
export const SiteOpening = ({
  className,
  fetchedAt,
  opensAt,
  serverNow,
  showCountdown,
}: {
  className?: string;
  /** When the client received `serverNow` (`dataUpdatedAt`), for the skew correction. */
  fetchedAt?: number;
  opensAt: string;
  /** The server's clock when it answered. */
  serverNow: string;
  /** `false` shows the date without the ticking countdown. */
  showCountdown: boolean;
}) => {
  const t = useTranslations("core.site_offline.countdown");
  const locale = useLocale();
  const serverNowMs = Date.parse(serverNow);
  const offsetMs = fetchedAt ? serverNowMs - fetchedAt : 0;
  const now = useServerClock(serverNowMs, offsetMs);
  const parts = countdownParts(Date.parse(opensAt), now);
  const twoDigits = React.useMemo(
    () => new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }),
    [locale],
  );
  const frame = cn(
    "bg-muted/60 flex flex-col gap-1 rounded-xl px-4 py-3 text-start sm:flex-row sm:items-center sm:justify-between sm:gap-4",
    className,
  );

  if (parts.done) {
    return (
      <div className={frame}>
        <p
          className="inline-flex items-center gap-2.5 text-base font-semibold"
          role="status"
        >
          <span aria-hidden="true" className="relative flex size-2">
            <span className="bg-primary absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping" />
            <span className="bg-primary relative inline-flex size-2 rounded-full" />
          </span>
          {t("opening_soon")}
        </p>
      </div>
    );
  }

  if (!showCountdown) {
    return (
      <div
        className={cn(frame, "flex-row items-center gap-3 sm:justify-start")}
      >
        <CalendarClockIcon
          aria-hidden="true"
          className="text-muted-foreground size-5 shrink-0"
        />
        <div className="flex flex-col gap-0.5">
          <p className="text-muted-foreground text-xs font-medium">
            {t("expected_back")}
          </p>
          <p className="text-base font-semibold">
            <OpensAtDate opensAt={opensAt} />
          </p>
        </div>
      </div>
    );
  }

  const visible = UNITS.filter(unit => unit !== "days" || parts.days > 0);

  return (
    <div className={frame}>
      <div className="flex flex-col gap-0.5">
        <p className="text-muted-foreground text-xs font-medium">
          {t("back_in")}
        </p>
        <p
          aria-label={t("label", {
            days: parts.days,
            hours: parts.hours,
            minutes: parts.minutes,
          })}
          className="flex flex-wrap items-baseline gap-x-2 text-xl font-semibold tabular-nums"
          role="timer"
        >
          {visible.map(unit => (
            <span
              aria-hidden="true"
              className="inline-flex items-baseline"
              key={unit}
            >
              <SlidingNumber formatter={twoDigits} value={parts[unit]} />
              <span className="text-muted-foreground ms-0.5 text-sm font-medium">
                {t(`units.${unit}`)}
              </span>
            </span>
          ))}
        </p>
      </div>
      <p className="text-muted-foreground inline-flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap">
        <CalendarClockIcon aria-hidden="true" className="size-4" />
        <OpensAtDate opensAt={opensAt} />
      </p>
    </div>
  );
};
