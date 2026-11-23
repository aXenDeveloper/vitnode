import type { SiteStatus } from "@vitnode/api/lib/site-status";

import { ClockIcon, SettingsIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { countdownParts } from "@/views/site-offline/countdown-parts";

import { HrefLink } from "../link";

const MANAGE_HREF = "/admin/core/debug#site-status";
const CLOCK_TICK_MS = 30_000;

const subscribeToClock = (onTick: () => void) => {
  const interval = window.setInterval(onTick, CLOCK_TICK_MS);
  document.addEventListener("visibilitychange", onTick);

  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onTick);
  };
};

const getClockSnapshot = () =>
  Math.floor(Date.now() / CLOCK_TICK_MS) * CLOCK_TICK_MS;

const getServerClockSnapshot = () => null;

const useClientNow = (): null | number =>
  React.useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );

const useOfflineDocumentTitle = () => {
  const t = useTranslations("core.site_offline.staff_banner");
  const format = React.useCallback(
    (title: string) => t("document_title", { title }),
    [t],
  );

  React.useEffect(() => {
    let baseTitle = document.title;
    let applied = format(baseTitle);
    document.title = applied;

    const observer = new MutationObserver(() => {
      if (document.title === applied) return;
      baseTitle = document.title;
      applied = format(baseTitle);
      document.title = applied;
    });
    observer.observe(document.head, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (document.title === applied) document.title = baseTitle;
    };
  }, [format]);
};

const ReopenTime = ({ opensAt }: { opensAt: string }) => {
  const t = useTranslations("core.site_offline.countdown");
  const now = useClientNow();
  if (now === null) return null;

  const parts = countdownParts(Date.parse(opensAt), now);

  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-sm leading-relaxed tabular-nums">
      <ClockIcon aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
      {parts.done
        ? t("opening_soon")
        : t("label", {
            days: parts.days,
            hours: parts.hours,
            minutes: parts.minutes,
          })}
    </p>
  );
};

const CompactReopenTime = ({ opensAt }: { opensAt: string }) => {
  const t = useTranslations("core.site_offline.countdown.units");
  const now = useClientNow();
  if (now === null) return null;

  const parts = countdownParts(Date.parse(opensAt), now);
  if (parts.done) return null;
  const units = [
    parts.days ? `${parts.days}${t("days")}` : null,
    parts.hours ? `${parts.hours}${t("hours")}` : null,
    `${parts.minutes}${t("minutes")}`,
  ].filter(Boolean);

  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground font-normal tabular-nums max-sm:hidden"
    >
      · {units.join(" ")}
    </span>
  );
};

/**
 * A floating pill for viewers who may use the offline site: the details and a
 * link to the AdminCP open in a popover, and every page title gets an
 * "(Offline)" prefix while it is mounted. Browser-only effects.
 */
export const SiteOfflineStaffChip = ({
  status,
}: {
  status: Pick<SiteStatus, "opensAt">;
}) => {
  const t = useTranslations("core.site_offline.staff_banner");
  useOfflineDocumentTitle();

  return (
    <div className="fixed start-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 sm:bottom-4">
      <Popover>
        <PopoverTrigger
          aria-label={t("trigger_label")}
          className="bg-card text-foreground hover:bg-muted focus-visible:ring-ring/50 aria-expanded:bg-muted flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-medium shadow-md ring-1 ring-black/5 transition-[background-color,scale] duration-150 ease-out outline-none focus-visible:ring-3 active:scale-97 dark:ring-white/10"
        >
          <span aria-hidden="true" className="relative flex size-2 shrink-0">
            <span className="bg-warn absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping" />
            <span className="bg-warn relative inline-flex size-2 rounded-full" />
          </span>
          {t("trigger")}
          {status.opensAt ? (
            <CompactReopenTime opensAt={status.opensAt} />
          ) : null}
        </PopoverTrigger>
        <PopoverContent align="start" side="top" sideOffset={8}>
          <PopoverHeader>
            <PopoverTitle className="text-balance">{t("title")}</PopoverTitle>
            <PopoverDescription className="leading-relaxed text-pretty">
              {t("desc")}
            </PopoverDescription>
          </PopoverHeader>
          {status.opensAt ? <ReopenTime opensAt={status.opensAt} /> : null}
          <HrefLink
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={MANAGE_HREF}
          >
            <SettingsIcon aria-hidden="true" />
            {t("manage")}
          </HrefLink>
        </PopoverContent>
      </Popover>
    </div>
  );
};
