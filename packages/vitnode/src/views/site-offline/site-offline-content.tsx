import type { SiteStatus } from "@vitnode/api/lib/site-status";

import { pickSiteOfflineMessage } from "@vitnode/api/lib/site-status";
import { cn } from "cn";
import { useTranslations } from "use-intl";

import { RichTextContent } from "@/components/rich-text";

import { SiteOpening } from "./countdown";

/**
 * What a visitor sees while the site is offline: a card with the logo, a
 * "Maintenance" badge, the reason in their language (falling back to the
 * default one) and, when the site has an opening time, a countdown or the
 * date alone.
 */
export const SiteOfflineContent = ({
  className,
  defaultLanguage,
  fetchedAt,
  language,
  logo,
  status,
}: {
  className?: string;
  defaultLanguage?: string;
  fetchedAt?: number;
  language: string;
  logo?: React.ReactNode;
  status: Pick<
    SiteStatus,
    "message" | "opensAt" | "serverNow" | "showCountdown"
  >;
}) => {
  const t = useTranslations("core.site_offline");
  const message = pickSiteOfflineMessage(
    status.message,
    language,
    defaultLanguage,
  );

  return (
    <article
      className={cn(
        "bg-card text-card-foreground @container flex w-full max-w-lg flex-col gap-6 rounded-2xl border p-6 shadow-lg sm:p-8",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center">{logo}</div>
        <span className="bg-warn/10 text-warn inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <span aria-hidden="true" className="relative flex size-2">
            <span className="bg-warn absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping" />
            <span className="bg-warn relative inline-flex size-2 rounded-full" />
          </span>
          {t("badge")}
        </span>
      </header>

      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t("title")}
        </h1>
        {message ? (
          <RichTextContent
            className="text-muted-foreground text-base leading-relaxed text-pretty"
            content={message}
          />
        ) : (
          <p className="text-muted-foreground text-base leading-relaxed text-pretty">
            {t("desc")}
          </p>
        )}
      </div>

      {status.opensAt ? (
        <SiteOpening
          fetchedAt={fetchedAt}
          opensAt={status.opensAt}
          serverNow={status.serverNow}
          showCountdown={status.showCountdown}
        />
      ) : null}
    </article>
  );
};
