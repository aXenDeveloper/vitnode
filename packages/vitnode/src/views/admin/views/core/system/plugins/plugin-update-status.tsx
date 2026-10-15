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

const ExternalLink = ({
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

export const SecurityAdvisories = ({
  sides,
  update,
}: {
  sides?: VersionSides;
  update: AdminComponentUpdate | undefined;
}) => {
  const t = useTranslations("admin.system.plugins");
  const advisories = update?.result?.advisories ?? [];
  if (advisories.length === 0) return null;

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
      className="flex flex-col gap-2"
    >
      {advisories.map(advisory => (
        <li
          className="border-destructive/30 bg-destructive/5 text-foreground flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm leading-relaxed"
          key={advisory.id}
        >
          <ShieldAlertIcon
            aria-hidden
            className="text-destructive mt-0.5 size-4 shrink-0"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-destructive font-medium text-pretty">
              {t("updates.security.title", {
                id: advisory.id,
                severity: t(`updates.severity.${advisory.severity}`),
              })}
            </p>
            <p className="text-pretty">
              {t("updates.security.affects", {
                range: advisory.affected,
                versions: describeVersions(advisory.versions),
              })}{" "}
              {advisory.fixed === null
                ? t("updates.security.no_fix")
                : t("updates.security.fixed", { version: advisory.fixed })}
            </p>
            {advisory.summary === null ? null : (
              <p className="text-muted-foreground text-pretty break-words">
                {advisory.summary}
              </p>
            )}
            <ExternalLink href={advisory.url}>
              {t("updates.security.details")}
            </ExternalLink>
          </div>
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
          {t("updates.status.up_to_date")}
        </Line>
      );
    case "update_available": {
      const latest = result.latest;
      if (latest === null) return null;

      return (
        <>
          <Line icon={ArrowUpCircleIcon} tone="primary">
            <span className="font-medium">
              {t("updates.status.update_available", {
                version: latest.version,
              })}
            </span>
            {latest.publishedAt === null ? null : (
              <span className="text-muted-foreground">
                {" "}
                {t.rich("updates.released", {
                  date: () => (
                    <DateFormat date={latest.publishedAt ?? ""} showFullDate />
                  ),
                })}
              </span>
            )}{" "}
            <ExternalLink href={latest.url}>
              {t("updates.release_notes")}
            </ExternalLink>
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
          {result.compatibility === "compatible" ? (
            <Line icon={CircleCheckIcon}>
              {t("updates.compatibility.compatible", {
                range: latest.requiresCore ?? "",
              })}
            </Line>
          ) : null}
          {result.alternative === null ? null : (
            <Line icon={ArrowUpCircleIcon}>
              {t("updates.compatibility.alternative", {
                version: result.alternative.version,
              })}{" "}
              <ExternalLink href={result.alternative.url}>
                {t("updates.release_notes")}
              </ExternalLink>
            </Line>
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
 * Security findings are rendered apart, by `SecurityAdvisories`, and never
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
