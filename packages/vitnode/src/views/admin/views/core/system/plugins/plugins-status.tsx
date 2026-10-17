import { cn } from "cn";
import {
  ArrowUpCircleIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleOffIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";

import type { PluginRow } from "./plugin-list";
import type {
  AdminPluginUpdates,
  CheckPluginUpdates,
} from "./plugin-updates-query";

import { CheckUpdatesButton } from "./check-updates-button";
import { ExternalLink } from "./plugin-update-status";

type StatusKind =
  | "disabled"
  | "error"
  | "ok"
  | "pending"
  | "security"
  | "unavailable"
  | "update";

const KIND_ICON = {
  disabled: {
    icon: CircleOffIcon,
    className: "bg-muted text-muted-foreground",
  },
  error: {
    icon: TriangleAlertIcon,
    className: "bg-warn/10 text-warn dark:bg-warn/20",
  },
  ok: {
    icon: CircleCheckIcon,
    className: "bg-success/10 text-success dark:bg-success/20",
  },
  pending: {
    icon: CircleDashedIcon,
    className: "bg-muted text-muted-foreground",
  },
  security: {
    icon: ShieldAlertIcon,
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
  unavailable: {
    icon: CircleOffIcon,
    className: "bg-muted text-muted-foreground",
  },
  update: {
    icon: ArrowUpCircleIcon,
    className: "bg-primary/10 text-primary dark:bg-primary/20",
  },
} as const;

const statusKindOf = (
  rows: PluginRow[],
  updates: AdminPluginUpdates | undefined,
): StatusKind => {
  if (updates === undefined) return "unavailable";
  if (rows.some(row => row.tone === "security")) return "security";
  if (!updates.enabled) return "disabled";
  if (rows.some(row => row.tone === "error")) return "error";
  if (rows.some(row => row.tone === "update")) return "update";
  if (rows.every(row => row.update?.lastSuccessAt == null)) return "pending";

  return "ok";
};

const lastCheckedOf = (rows: PluginRow[]): null | string =>
  rows
    .map(row => row.update?.lastSuccessAt ?? null)
    .reduce<null | string>(
      (latest, value) =>
        value !== null && (latest === null || value > latest) ? value : latest,
      null,
    );

const StatusBody = ({
  kind,
  rows,
  updates,
}: {
  kind: StatusKind;
  rows: PluginRow[];
  updates: AdminPluginUpdates | undefined;
}) => {
  const t = useTranslations("admin.system.plugins.status");
  const tChannel = useTranslations("admin.system.plugins.updates.channel");
  const format = useFormatter();

  if (kind === "security") {
    const findings = rows.flatMap(row =>
      (row.update?.result?.securityUpdates ?? []).map(entry => ({
        entry,
        row,
      })),
    );

    return (
      <ul className="flex flex-col gap-1">
        {findings.map(({ entry, row }) => (
          <li className="text-pretty" key={`${row.id}-${entry.id}`}>
            <span className="text-foreground font-medium">{row.title}</span>{" "}
            {row.version === null ? null : (
              <span className="font-mono text-xs">{row.version}</span>
            )}{" "}
            —{" "}
            {entry.fixed === null
              ? t("security_no_fix")
              : t("security_fixed", { version: entry.fixed })}{" "}
            <ExternalLink href={entry.url}>{entry.id}</ExternalLink>
          </li>
        ))}
      </ul>
    );
  }

  if (kind === "error") {
    const failed = rows.filter(row => row.tone === "error");

    return (
      <p className="text-pretty">
        {t("error_desc", {
          names: format.list(failed.map(row => row.title)),
        })}
      </p>
    );
  }

  if (kind === "update") {
    const available = rows.filter(row => row.tone === "update");

    return (
      <p className="text-pretty">
        {format.list(
          available.map(
            row => `${row.title} ${row.update?.result?.latest?.version ?? ""}`,
          ),
        )}
      </p>
    );
  }

  if (kind === "unavailable") {
    return <p className="text-pretty">{t("unavailable_desc")}</p>;
  }

  const lastChecked = lastCheckedOf(rows);
  const channel = updates?.channelOverride ?? null;

  if (lastChecked === null && channel === null) return null;

  return (
    <p className="text-pretty">
      {lastChecked === null || kind !== "ok"
        ? null
        : t.rich("checked", {
            date: () => <DateFormat date={lastChecked} />,
          })}
      {channel === null ? null : (
        <> {t("channel", { channel: tChannel(channel) })}</>
      )}
    </p>
  );
};

export const PluginsStatus = ({
  onCheck,
  rows,
  updates,
}: {
  onCheck: CheckPluginUpdates;
  rows: PluginRow[];
  updates: AdminPluginUpdates | undefined;
}) => {
  const t = useTranslations("admin.system.plugins.status");
  const kind = statusKindOf(rows, updates);
  const { className, icon: Icon } = KIND_ICON[kind];
  const securityCount = rows.reduce(
    (sum, row) => sum + (row.update?.result?.securityUpdates.length ?? 0),
    0,
  );
  const trackedCount = rows.filter(
    row => row.update !== undefined && row.update.state !== "unavailable",
  ).length;

  const title = {
    disabled: t("disabled_title"),
    error: t("error_title", {
      failed: rows.filter(row => row.tone === "error").length,
      total: trackedCount,
    }),
    ok: t("ok_title"),
    pending: t("pending_title"),
    security: t("security_title", { count: securityCount }),
    unavailable: t("unavailable_title"),
    update: t("update_title", {
      count: rows.filter(row => row.tone === "update").length,
    }),
  }[kind];

  return (
    <section
      aria-labelledby="plugins-status-title"
      className={cn(
        "flex flex-col gap-4 rounded-xl p-5 shadow-xs ring-1 sm:flex-row sm:items-start",
        kind === "security"
          ? "bg-destructive/5 ring-destructive/25 dark:bg-destructive/10"
          : "bg-card text-card-foreground ring-foreground/10",
      )}
      role={kind === "security" ? "alert" : undefined}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          className,
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="text-muted-foreground flex min-w-0 flex-1 flex-col gap-1 text-sm leading-relaxed">
        <h2
          className="text-foreground text-lg font-semibold text-balance"
          id="plugins-status-title"
        >
          {title}
        </h2>
        <StatusBody kind={kind} rows={rows} updates={updates} />
      </div>
      {kind === "disabled" ? null : (
        <CheckUpdatesButton onCheck={onCheck} retry={kind === "error"} />
      )}
    </section>
  );
};
