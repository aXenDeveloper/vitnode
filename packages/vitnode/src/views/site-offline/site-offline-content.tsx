import type { SiteStatus } from "@vitnode/api/lib/site-status";

import { pickSiteOfflineMessage } from "@vitnode/api/lib/site-status";
import { cn } from "cn";
import { PowerOffIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { RichTextContent } from "@/components/rich-text";

import { SiteCountdown } from "./countdown";

/**
 * What a visitor sees while the site is offline: the reason in their
 * language (falling back to the default one), the countdown when the site
 * has an opening time, and `footer` (the staff sign-in link). Framework-free,
 * so the AdminCP previews the same markup.
 */
export const SiteOfflineContent = ({
  className,
  defaultLanguage,
  fetchedAt,
  footer,
  headingLevel = 1,
  language,
  logo,
  status,
}: {
  className?: string;
  defaultLanguage?: string;
  fetchedAt?: number;
  footer?: React.ReactNode;
  /** `2` inside a page that already has its `<h1>`, like the AdminCP preview. */
  headingLevel?: 1 | 2;
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
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 py-12 text-center sm:py-20",
        className,
      )}
    >
      {logo ? <div className="flex items-center gap-2">{logo}</div> : null}

      <div className="flex flex-col items-center gap-4">
        <span
          aria-hidden="true"
          className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl border"
        >
          <PowerOffIcon className="size-6" />
        </span>
        <Heading className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t("title")}
        </Heading>
        {message ? (
          <RichTextContent
            className="text-muted-foreground max-w-prose text-base leading-relaxed text-pretty"
            content={message}
          />
        ) : (
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed text-pretty">
            {t("desc")}
          </p>
        )}
      </div>

      {status.showCountdown && status.opensAt ? (
        <SiteCountdown
          fetchedAt={fetchedAt}
          opensAt={status.opensAt}
          serverNow={status.serverNow}
        />
      ) : null}

      {footer}
    </div>
  );
};
