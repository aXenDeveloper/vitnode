import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import type { AdminPluginUpdates } from "@/views/admin/views/core/system/plugins/plugin-updates-query";

import { DateFormat } from "@/components/date-format";
import { buttonVariants } from "@/components/ui/button";
import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import {
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { debugTabPath } from "@/tanstack/admin/debug/route-search";

import { coreSecurityUpdate } from "../health/health";

const SECURITY_SURFACE =
  "bg-destructive/5 ring-destructive/25 dark:bg-destructive/10 ring-1";

export const SecurityUpdateAlert = ({
  updates,
  version,
}: {
  updates: AdminPluginUpdates | undefined;
  version: string;
}) => {
  const t = useTranslations("admin.debug.security");
  const security = coreSecurityUpdate(updates);
  if (!security) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center",
        SECURITY_SURFACE,
      )}
      role="alert"
    >
      <span className="bg-destructive/10 flex size-9 shrink-0 items-center justify-center rounded-lg">
        <ShieldAlertIcon
          aria-hidden
          className={cn("size-5", FEEDBACK_TONE_TEXT.destructive)}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-semibold text-pretty">
          {t("alert.title", { version: security.fixedVersion ?? "" })}
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("alert.desc", { version })}
        </p>
      </div>
      <Link
        className={cn(
          buttonVariants({ size: "sm", variant: "destructive" }),
          "shrink-0 self-start sm:self-center",
        )}
        to={debugTabPath("vitnode")}
      >
        {t("alert.review")}
        <ArrowRightIcon aria-hidden />
      </Link>
    </div>
  );
};

const Row = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
    <span className="text-muted-foreground text-sm">{label}</span>
    <div className="min-w-0 text-sm">{children}</div>
  </div>
);

export const SecurityUpdatePanel = ({
  updates,
  version,
}: {
  updates: AdminPluginUpdates | undefined;
  version: string;
}) => {
  const t = useTranslations("admin.debug.security");
  const security = coreSecurityUpdate(updates);
  if (!security) return null;

  const { latest, securityUpdate } = security;
  const fixed = security.fixedVersion;

  return (
    <section
      aria-labelledby="debug-security-update"
      className={cn("flex flex-col rounded-lg p-1", SECURITY_SURFACE)}
    >
      <FrameHeader>
        <FrameTitle
          className="flex items-center gap-2"
          id="debug-security-update"
        >
          <ShieldAlertIcon
            aria-hidden
            className={cn("size-5", FEEDBACK_TONE_TEXT.destructive)}
          />
          {t("panel.title")}
        </FrameTitle>
        <FrameDescription>
          {fixed
            ? t("panel.desc", { fixed, version })
            : t("panel.desc_no_fix", { version })}
        </FrameDescription>
      </FrameHeader>
      <FramePanel>
        <Row label={t("panel.details")}>
          <a
            className="text-primary inline-flex items-center gap-1 hover:underline"
            href={securityUpdate.url}
            rel="noreferrer"
            target="_blank"
          >
            {securityUpdate.id}
            <ExternalLinkIcon aria-hidden className="size-3.5" />
          </a>
        </Row>
        <Row label={t("panel.version")}>
          <span className="flex flex-wrap items-center gap-2 tabular-nums">
            <span
              className={cn(
                "font-medium line-through decoration-1",
                FEEDBACK_TONE_TEXT.destructive,
              )}
            >
              {version}
            </span>
            {fixed ? (
              <>
                <ArrowRightIcon
                  aria-hidden
                  className="text-muted-foreground size-4"
                />
                <span className="font-medium">{fixed}</span>
              </>
            ) : null}
            {latest?.publishedAt ? (
              <span className="text-muted-foreground">
                {t.rich("panel.released", {
                  date: () => <DateFormat date={latest.publishedAt ?? ""} />,
                })}
              </span>
            ) : null}
          </span>
        </Row>
        {latest?.url ? (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <a
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={latest.url}
              rel="noreferrer"
              target="_blank"
            >
              {t("panel.release_notes")}
              <ExternalLinkIcon aria-hidden />
            </a>
          </div>
        ) : null}
      </FramePanel>
    </section>
  );
};
