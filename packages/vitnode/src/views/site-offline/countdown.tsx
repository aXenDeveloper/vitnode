import { cn } from "cn";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

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

/**
 * A countdown to `opensAt` with rolling digits. When it reaches zero it
 * shows "Opening soon" - it never opens anything by itself.
 */
export const SiteCountdown = ({
  className,
  fetchedAt,
  opensAt,
  serverNow,
}: {
  className?: string;
  /** When the client received `serverNow` (`dataUpdatedAt`), for the skew correction. */
  fetchedAt?: number;
  opensAt: string;
  /** The server's clock when it answered. */
  serverNow: string;
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

  if (parts.done) {
    return (
      <p
        className={cn(
          "bg-card text-foreground inline-flex items-center gap-3 rounded-full border px-5 py-2.5 text-base font-medium shadow-xs",
          className,
        )}
        role="status"
      >
        <span aria-hidden="true" className="relative flex size-2.5">
          <span className="bg-primary absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping" />
          <span className="bg-primary relative inline-flex size-2.5 rounded-full" />
        </span>
        {t("opening_soon")}
      </p>
    );
  }

  const visible = UNITS.filter(unit => unit !== "days" || parts.days > 0);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <p className="text-muted-foreground text-sm leading-relaxed font-medium">
        {t("title")}
      </p>
      <div
        aria-label={t("label", {
          days: parts.days,
          hours: parts.hours,
          minutes: parts.minutes,
        })}
        className="grid grid-flow-col gap-2 sm:gap-3"
        role="timer"
      >
        {visible.map(unit => (
          <div
            className="bg-card text-card-foreground flex min-w-16 flex-col items-center gap-1 rounded-xl border px-3 py-3 shadow-xs sm:min-w-20 sm:px-4 sm:py-4"
            key={unit}
          >
            <SlidingNumber
              aria-hidden="true"
              className="text-3xl font-semibold tracking-tight sm:text-5xl"
              formatter={twoDigits}
              value={parts[unit]}
            />
            <span
              aria-hidden="true"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              {t(`units.${unit}`, { count: parts[unit] })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
