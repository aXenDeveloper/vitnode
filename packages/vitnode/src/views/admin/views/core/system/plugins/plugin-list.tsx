import { cn } from "cn";
import {
  ArrowUpCircleIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  CircleOffIcon,
  PackageIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";

import type { PluginTone } from "./plugin-tone";
import type { AdminComponentUpdate } from "./plugin-updates-query";
import type { AdminInstalledPlugin, AdminPluginAuthor } from "./plugins-query";

import { PluginIcon } from "./plugin-icon";
import {
  ExternalLink,
  PluginUpdateStatus,
  safeHttpsHref,
  SecurityUpdates,
  type VersionSides,
} from "./plugin-update-status";
import { PluginVersion } from "./plugin-version";

export interface PluginRow {
  author: AdminPluginAuthor | null;
  description: null | string;
  icon: null | string;
  id: string;
  kind: "core" | "plugin";
  license: null | string;
  registrations: AdminInstalledPlugin["registrations"] | null;
  title: string;
  tone: null | PluginTone;
  update: AdminComponentUpdate | undefined;
  version: null | string;
  versionMismatch: boolean;
}

const TONE_BADGE = {
  security: {
    icon: ShieldAlertIcon,
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
  error: {
    icon: TriangleAlertIcon,
    className: "bg-warn/10 text-warn dark:bg-warn/20",
  },
  update: {
    icon: ArrowUpCircleIcon,
    className: "bg-primary/10 text-primary dark:bg-primary/20",
  },
  unknown: {
    icon: CircleHelpIcon,
    className: "bg-muted text-muted-foreground",
  },
  pending: {
    icon: CircleDashedIcon,
    className: "bg-muted text-muted-foreground",
  },
  ok: {
    icon: CircleCheckIcon,
    className: "bg-success/10 text-success dark:bg-success/20",
  },
  off: {
    icon: CircleOffIcon,
    className: "bg-muted text-muted-foreground",
  },
  disabled: {
    icon: CircleOffIcon,
    className: "bg-muted text-muted-foreground",
  },
} as const;

const StatusBadge = ({ tone }: { tone: PluginTone }) => {
  const t = useTranslations("admin.system.plugins.badge");
  const { className, icon: Icon } = TONE_BADGE[tone];

  return (
    <Badge className={cn("gap-1", className)} variant="secondary">
      <Icon aria-hidden data-icon="inline-start" />
      {t(tone)}
    </Badge>
  );
};

const RowIcon = ({ row }: { row: PluginRow }) =>
  row.kind === "core" ? (
    <span
      aria-hidden="true"
      className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
    >
      <PackageIcon className="size-5" />
    </span>
  ) : (
    <PluginIcon icon={row.icon} />
  );

const versionSidesOf = (row: PluginRow): VersionSides => {
  if (!row.versionMismatch || row.registrations === null) return {};

  const sides: VersionSides = {};
  const { api, frontend } = row.registrations;
  if (api?.version) sides[api.version] = [...(sides[api.version] ?? []), "api"];
  if (frontend?.version) {
    sides[frontend.version] = [...(sides[frontend.version] ?? []), "frontend"];
  }

  return sides;
};

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

const Facts = ({ className, row }: { className?: string; row: PluginRow }) => {
  const t = useTranslations("admin.system.plugins");
  const update = row.update;
  const website = safeHttpsHref(row.author?.url ?? null);
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t("facts.author"), value: row.author?.name ?? <Muted>—</Muted> },
    {
      label: t("facts.website"),
      value:
        website === null ? (
          <Muted>—</Muted>
        ) : (
          <ExternalLink href={website}>{hostOf(website)}</ExternalLink>
        ),
    },
    {
      label: t("facts.license"),
      value: row.license ?? <Muted>{t("facts.not_specified")}</Muted>,
    },
  ];

  if (update?.sourceUrl) {
    const channel = update.result?.channel;
    facts.push(
      {
        label: t("facts.channel"),
        value: channel ? t(`updates.channel.${channel}`) : <Muted>—</Muted>,
      },
      {
        label: t("facts.last_check"),
        value:
          update.lastSuccessAt === null ? (
            <Muted>{t("facts.never")}</Muted>
          ) : (
            <DateFormat date={update.lastSuccessAt} />
          ),
      },
      {
        label: t("facts.source"),
        value: (
          <span className="font-mono text-xs break-all">
            {hostOf(update.sourceUrl)}
          </span>
        ),
      },
    );
  } else if (update !== undefined) {
    facts.push({
      label: t("facts.source"),
      value: <Muted>{t("facts.none")}</Muted>,
    });
  }

  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {facts.map(fact => (
        <div className="flex min-w-0 flex-col gap-1" key={fact.label}>
          <dt className="text-muted-foreground text-xs">{fact.label}</dt>
          <dd className="min-w-0 text-sm break-words">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
};

const Panel = ({
  coreVersion,
  enabled,
  row,
}: {
  coreVersion: string;
  enabled: boolean;
  row: PluginRow;
}) => {
  const t = useTranslations("admin.system.plugins");
  const { api, frontend } = row.registrations ?? { api: null, frontend: null };
  const showMismatch =
    row.versionMismatch && !!api?.version && !!frontend?.version;
  const showSecurity = (row.update?.result?.securityUpdates.length ?? 0) > 0;
  const showStatus =
    row.update !== undefined &&
    (!enabled || row.update.state !== "unavailable");
  const hasStatus = showMismatch || showSecurity || showStatus;

  return (
    <div className="bg-muted/50 ring-foreground/5 flex flex-col gap-5 rounded-lg p-5 ring-1">
      {hasStatus ? (
        <div className="flex flex-col gap-3">
          {showMismatch ? (
            <p className="text-warn flex items-start gap-1.5 text-sm leading-relaxed text-pretty">
              <TriangleAlertIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0"
              />
              {t("mismatch", {
                api: api?.version ?? "",
                frontend: frontend?.version ?? "",
              })}
            </p>
          ) : null}
          <SecurityUpdates sides={versionSidesOf(row)} update={row.update} />
          {showStatus ? (
            <PluginUpdateStatus
              coreVersion={coreVersion}
              enabled={enabled}
              showCheckedAt={false}
              update={row.update}
            />
          ) : null}
        </div>
      ) : null}
      <Facts
        className={hasStatus ? "border-border border-t pt-5" : undefined}
        row={row}
      />
    </div>
  );
};

const PluginListRow = ({
  coreVersion,
  enabled,
  row,
}: {
  coreVersion: string;
  enabled: boolean;
  row: PluginRow;
}) => {
  const t = useTranslations("admin.system.plugins");

  return (
    <Collapsible
      className="has-[[data-slot=collapsible-trigger]:hover]:bg-muted/40 transition-[background-color] duration-150 ease-out motion-reduce:transition-none"
      defaultOpen={row.tone === "security" || row.tone === "error"}
      render={<li />}
    >
      <CollapsibleTrigger className="group/trigger focus-visible:ring-ring/50 flex w-full cursor-pointer flex-col gap-3 p-4 text-start outline-none focus-visible:ring-3 focus-visible:ring-inset sm:flex-row sm:items-start">
        <span className="flex min-w-0 flex-1 items-start gap-3">
          <RowIcon row={row} />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-pretty">{row.title}</span>
                {row.kind === "core" ? (
                  <Badge variant="outline">{t("core.badge")}</Badge>
                ) : null}
              </span>
              {row.kind === "plugin" && row.title !== row.id ? (
                <span className="text-muted-foreground font-mono text-xs break-all">
                  {row.id}
                </span>
              ) : null}
            </span>
            {row.description === null ? null : (
              <span className="text-muted-foreground max-w-prose text-sm leading-relaxed text-pretty">
                {row.description}
              </span>
            )}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 ps-13 sm:flex-col sm:flex-nowrap sm:items-end sm:gap-1.5 sm:ps-0">
          <PluginVersion className="text-sm" version={row.version} />
          {row.tone === null ? null : <StatusBadge tone={row.tone} />}
        </span>
        <ChevronDownIcon
          aria-hidden
          className="text-muted-foreground mt-3 hidden size-4 shrink-0 transition-transform duration-200 ease-out group-data-panel-open/trigger:rotate-180 motion-reduce:transition-none sm:block"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="px-4 pb-5 sm:ps-17 sm:pe-11">
          <Panel coreVersion={coreVersion} enabled={enabled} row={row} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const PluginList = ({
  coreVersion,
  enabled,
  rows,
}: {
  coreVersion: string;
  enabled: boolean;
  rows: PluginRow[];
}) => {
  const t = useTranslations("admin.system.plugins.installed");

  return (
    <Frame aria-labelledby="installed-plugins-title" render={<section />}>
      <FrameHeader>
        <FrameTitle id="installed-plugins-title" render={<h2 />}>
          {t("title")}
        </FrameTitle>
        <FrameDescription>
          {t("desc", { count: rows.length - 1 })}
        </FrameDescription>
      </FrameHeader>
      <FramePanel render={<ul />}>
        {rows.map(row => (
          <PluginListRow
            coreVersion={coreVersion}
            enabled={enabled}
            key={row.id}
            row={row}
          />
        ))}
      </FramePanel>
    </Frame>
  );
};
