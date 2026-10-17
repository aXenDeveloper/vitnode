import { cn } from "cn";
import {
  ArrowUpCircleIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  CircleOffIcon,
  ClockAlertIcon,
  ExternalLinkIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";

import type { AdminComponentUpdate } from "./plugin-updates-query";

import { PluginVersion } from "./plugin-version";

/**
 * Publisher data is untrusted: a link is only rendered when it is an absolute
 * https:// URL, whatever the API already checked.
 */
export const safeHttpsHref = (value: null | string): null | string => {
  if (value === null) return null;

  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};

export const ExternalLink = ({
  children,
  href,
}: {
  children: React.ReactNode;
  href: null | string;
}) => {
  const safe = safeHttpsHref(href);
  if (safe === null) return null;

  return (
    <a
      className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
      href={safe}
      rel="noopener noreferrer nofollow"
      target="_blank"
    >
      {children}
      <ExternalLinkIcon aria-hidden className="size-3.5" />
    </a>
  );
};

/** Which registration runs each version, for "1.0.0 (web app)". */
export type VersionSides = Record<string, ("api" | "frontend")[]>;

export const SecurityUpdates = ({
  sides,
  update,
}: {
  sides?: VersionSides;
  update: AdminComponentUpdate | undefined;
}) => {
  const t = useTranslations("admin.system.plugins");
  const securityUpdates = update?.result?.securityUpdates ?? [];
  if (securityUpdates.length === 0) return null;

  const describeVersions = (versions: readonly string[]): string =>
    versions
      .map(version => {
        const labels = sides?.[version];
        const [side] = labels ?? [];
        if (labels?.length !== 1 || side === undefined) return version;

        return t("updates.version_on_side", {
          side: t(`updates.side.${side}`),
          version,
        });
      })
      .join(", ");

  return (
    <ul
      aria-label={t("updates.security.label")}
      className="flex flex-col gap-1.5"
    >
      {securityUpdates.map(securityUpdate => (
        <li
          className="text-destructive flex items-start gap-1.5 text-sm leading-relaxed"
          key={securityUpdate.id}
        >
          <ShieldAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="min-w-0 text-pretty">
            <span className="font-medium">
              {t("updates.security.title", { id: securityUpdate.id })}
            </span>{" "}
            {t("updates.security.affects", {
              range: securityUpdate.affected,
              versions: describeVersions(securityUpdate.versions),
            })}{" "}
            {securityUpdate.fixed === null
              ? t("updates.security.no_fix")
              : t("updates.security.fixed", {
                  version: securityUpdate.fixed,
                })}{" "}
            <ExternalLink href={securityUpdate.url}>
              {t("updates.security.details")}
            </ExternalLink>
          </p>
        </li>
      ))}
    </ul>
  );
};

const LINE_TONE = {
  muted: "text-muted-foreground",
  primary: "text-foreground",
  success: "text-success",
  warn: "text-warn",
} as const;

const Line = ({
  children,
  icon: Icon,
  tone = "muted",
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
  tone?: keyof typeof LINE_TONE;
}) => (
  <p
    className={cn(
      "flex items-start gap-1.5 text-sm leading-relaxed text-pretty",
      LINE_TONE[tone],
    )}
  >
    <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
    <span className="min-w-0">{children}</span>
  </p>
);

const CHECK_ERRORS = [
  "blocked_address",
  "http_error",
  "invalid_json",
  "invalid_manifest",
  "invalid_url",
  "network",
  "timeout",
  "too_large",
  "too_many_redirects",
  "unsupported_schema",
] as const;

const errorCode = (
  error: NonNullable<AdminComponentUpdate["lastError"]>,
): (typeof CHECK_ERRORS)[number] =>
  CHECK_ERRORS.find(entry => entry === error.code) ?? "network";

const ResultLines = ({
  coreVersion,
  update,
}: {
  coreVersion: string;
  update: AdminComponentUpdate;
}) => {
  const t = useTranslations("admin.system.plugins");
  const result = update.result;
  if (result === null) return null;

  switch (result.status) {
    case "channel_missing":
      return (
        <Line icon={CircleHelpIcon}>
          {t("updates.status.channel_missing", {
            channel: t(`updates.channel.${result.channel ?? "stable"}`),
          })}
        </Line>
      );
    case "package_missing":
      return (
        <Line icon={CircleHelpIcon}>{t("updates.status.package_missing")}</Line>
      );
    case "unknown_channel":
      return (
        <Line icon={CircleHelpIcon} tone="warn">
          {t("updates.status.unknown_channel")}
        </Line>
      );
    case "up_to_date":
      return (
        <Line icon={CircleCheckIcon} tone="success">
          {t("updates.status.up_to_date", {
            channel: t(`updates.channel.${result.channel ?? "stable"}`),
          })}
        </Line>
      );
    case "update_available": {
      const latest = result.latest;
      if (latest === null) return null;

      return (
        <>
          <Line icon={ArrowUpCircleIcon} tone="primary">
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="inline-flex flex-wrap items-center gap-1.5 font-medium">
                {t.rich("updates.status.update_available", {
                  version: () => <PluginVersion version={latest.version} />,
                })}
              </span>
              {latest.publishedAt === null ? null : (
                <span className="text-muted-foreground">
                  ·{" "}
                  {t.rich("updates.released", {
                    date: () => <DateFormat date={latest.publishedAt ?? ""} />,
                  })}
                </span>
              )}
              {safeHttpsHref(latest.url) === null ? null : (
                <>
                  <span aria-hidden className="text-muted-foreground">
                    ·
                  </span>
                  <ExternalLink href={latest.url}>
                    {t("updates.release_notes")}
                  </ExternalLink>
                </>
              )}
            </span>
          </Line>
          {result.compatibility === "incompatible" ? (
            <Line icon={TriangleAlertIcon} tone="warn">
              {t("updates.compatibility.incompatible", {
                core: coreVersion,
                range: latest.requiresCore ?? "",
              })}
            </Line>
          ) : null}
          {result.compatibility === "unknown" ? (
            <Line icon={CircleHelpIcon}>
              {t("updates.compatibility.unknown")}
            </Line>
          ) : null}
          {result.alternative === null ? null : (
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 ps-5.5 text-sm leading-relaxed">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {t.rich("updates.compatibility.alternative", {
                  version: () => (
                    <PluginVersion
                      className="text-foreground"
                      version={result.alternative?.version ?? null}
                    />
                  ),
                })}
              </span>
              {safeHttpsHref(result.alternative.url) === null ? null : (
                <>
                  <span aria-hidden>·</span>
                  <ExternalLink href={result.alternative.url}>
                    {t("updates.release_notes")}
                  </ExternalLink>
                </>
              )}
            </p>
          )}
        </>
      );
    }
    case "version_unknown":
      return (
        <Line icon={CircleHelpIcon} tone="warn">
          {t("updates.status.version_unknown")}
        </Line>
      );
  }
};

/**
 * Update availability, compatibility and check health - each its own line.
 * Security findings are rendered apart, by `SecurityUpdates`, and never
 * folded into "update available".
 */
export const PluginUpdateStatus = ({
  coreVersion,
  enabled,
  showCheckedAt = true,
  update,
}: {
  coreVersion: string;
  enabled: boolean;
  /** Off where the same date is already shown nearby. */
  showCheckedAt?: boolean;
  update: AdminComponentUpdate | undefined;
}) => {
  const t = useTranslations("admin.system.plugins");

  if (update === undefined) return null;
  if (!enabled) {
    return <Line icon={CircleOffIcon}>{t("updates.status.disabled")}</Line>;
  }
  if (update.state === "unavailable") {
    return <Line icon={CircleOffIcon}>{t("updates.status.unavailable")}</Line>;
  }

  const lastError = update.lastError;
  const reason =
    lastError === null
      ? ""
      : t(`updates.error.${errorCode(lastError)}`, {
          detail: lastError.detail ?? "",
        });

  return (
    <div className="flex flex-col gap-1">
      {update.state === "not_checked" && lastError === null ? (
        <Line icon={CircleDashedIcon}>{t("updates.status.not_checked")}</Line>
      ) : null}

      <ResultLines coreVersion={coreVersion} update={update} />

      {update.stale && update.lastSuccessAt !== null ? (
        <Line icon={ClockAlertIcon} tone="warn">
          {t.rich("updates.stale", {
            date: () => (
              <DateFormat date={update.lastSuccessAt ?? ""} showFullDate />
            ),
          })}
        </Line>
      ) : null}

      {lastError === null ? null : (
        <Line icon={TriangleAlertIcon} tone="warn">
          {update.state === "checked" && update.lastSuccessAt !== null
            ? t.rich("updates.failed_with_previous", {
                date: () => (
                  <DateFormat date={update.lastSuccessAt ?? ""} showFullDate />
                ),
                reason,
              })
            : t("updates.failed", { reason })}
        </Line>
      )}

      {showCheckedAt &&
      update.state === "checked" &&
      !update.stale &&
      lastError === null &&
      update.lastSuccessAt !== null ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t.rich("updates.checked_at", {
            date: () => <DateFormat date={update.lastSuccessAt ?? ""} />,
          })}
        </p>
      ) : null}
    </div>
  );
};
