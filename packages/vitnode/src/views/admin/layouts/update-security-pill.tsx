import type { LucideIcon } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { DownloadIcon, ShieldAlertIcon, TriangleAlertIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { pluginUpdatesQueryOptions } from "@/views/admin/views/core/system/plugins/plugin-updates-query";
import { installedPluginsQueryOptions } from "@/views/admin/views/core/system/plugins/plugins-query";
import {
  type AdminUpdateSummary,
  useAdminUpdateSummary,
} from "@/views/admin/views/core/system/plugins/update-summary-query";

import type { UpdateEntry } from "./update-entries";

import { AdminLink } from "./admin-link";
import { ADMIN_PLUGINS_HREF } from "./sidebar/nav/nav-model";
import { updateGroupsOf } from "./update-entries";

const GROUP_LIMIT = 4;

const UpdateGroup = ({
  entries,
  icon: Icon,
  id,
  onNavigate,
  title,
  tone,
}: {
  entries: UpdateEntry[];
  icon: LucideIcon;
  id: string;
  onNavigate: () => void;
  title: string;
  tone: "destructive" | "muted";
}) => {
  const t = useTranslations("admin.global.updates.security_pill");

  if (entries.length === 0) return null;

  const shown = entries.slice(0, GROUP_LIMIT);
  const hidden = entries.length - shown.length;

  return (
    <section aria-labelledby={id} className="flex flex-col gap-1 p-2">
      <h3
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 text-xs font-medium",
          tone === "destructive" ? "text-destructive" : "text-muted-foreground",
        )}
        id={id}
      >
        <Icon aria-hidden className="size-3.5" />
        {title}
        <span className="tabular-nums">{entries.length}</span>
      </h3>
      <ul className="flex flex-col">
        {shown.map(entry => (
          <li key={entry.id}>
            <AdminLink
              aria-label={
                entry.version === null
                  ? entry.title
                  : t("entry_label", {
                      title: entry.title,
                      version: entry.version,
                    })
              }
              className="hover:bg-muted focus-visible:bg-muted flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-[background-color] duration-150 ease-out outline-none"
              href={ADMIN_PLUGINS_HREF}
              onClick={onNavigate}
            >
              <span className="truncate text-sm">{entry.title}</span>
              {entry.version === null ? null : (
                <span className="text-muted-foreground max-w-40 shrink-0 truncate font-mono text-xs tabular-nums">
                  {entry.version}
                </span>
              )}
            </AdminLink>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="text-muted-foreground px-2 text-xs leading-relaxed">
          {t("more", { count: hidden })}
        </p>
      ) : null}
    </section>
  );
};

const UpdateGroupsSkeleton = () => (
  <div className="flex flex-col gap-3 p-4">
    <Skeleton className="h-4 w-28" />
    <Skeleton className="h-5 w-full" />
    <Skeleton className="h-5 w-full" />
    <Skeleton className="h-5 w-3/4" />
  </div>
);

const SecurityPillContent = ({
  onNavigate,
  summary,
}: {
  onNavigate: () => void;
  summary: AdminUpdateSummary;
}) => {
  const t = useTranslations("admin.global.updates.security_pill");
  const updates = useQuery(pluginUpdatesQueryOptions());
  const installed = useQuery(installedPluginsQueryOptions());
  const lastKnown = summary.failedComponents > 0 || summary.stale;
  const { lastAttemptAt } = summary;

  const groups = React.useMemo(
    () =>
      updates.data === undefined
        ? null
        : updateGroupsOf({
            coreTitle: t("core"),
            plugins: installed.data?.plugins,
            updates: updates.data,
          }),
    [installed.data, t, updates.data],
  );
  const total =
    groups === null ? null : groups.security.length + groups.other.length;

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <PopoverTitle className="font-semibold">
          {total === null
            ? t("label", { count: summary.affectedComponents })
            : t("title", { count: total })}
        </PopoverTitle>
        {lastAttemptAt === null ? null : (
          <p className="text-muted-foreground shrink-0 text-xs">
            {t.rich("checked", {
              date: () => <DateFormat date={lastAttemptAt} />,
            })}
          </p>
        )}
      </div>

      {updates.isError ? (
        <p className="text-muted-foreground px-4 py-3 text-sm leading-relaxed text-pretty">
          {t("load_error")}
        </p>
      ) : groups === null ? (
        <UpdateGroupsSkeleton />
      ) : (
        <div className="divide-border flex max-h-80 flex-col divide-y overflow-y-auto overscroll-contain">
          <UpdateGroup
            entries={groups.security}
            icon={ShieldAlertIcon}
            id="admin-security-pill-security"
            onNavigate={onNavigate}
            title={t("security")}
            tone="destructive"
          />
          <UpdateGroup
            entries={groups.other}
            icon={DownloadIcon}
            id="admin-security-pill-other"
            onNavigate={onNavigate}
            title={t("other")}
            tone="muted"
          />
        </div>
      )}

      {lastKnown ? (
        <p className="text-warn flex items-start gap-1.5 border-t px-4 py-2 text-xs leading-relaxed text-pretty">
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {t("last_known")}
        </p>
      ) : null}

      <AdminLink
        className="text-primary hover:bg-muted focus-visible:bg-muted rounded-b-xl border-t px-4 py-2.5 text-center text-sm font-medium transition-[background-color] duration-150 ease-out outline-none"
        href={ADMIN_PLUGINS_HREF}
        onClick={onNavigate}
      >
        {t("open_plugins")}
      </AdminLink>
    </div>
  );
};

export const AdminUpdateSecurityPill = () => {
  const t = useTranslations("admin.global.updates.security_pill");
  const { data } = useAdminUpdateSummary();
  const [open, setOpen] = React.useState(false);

  if (!data?.enabled || data.affectedComponents === 0) return null;

  const label = t("label", { count: data.affectedComponents });

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={label}
        className="bg-destructive/10 text-destructive hover:bg-destructive/15 aria-expanded:bg-destructive/15 focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-[background-color,scale] duration-150 ease-out outline-none focus-visible:ring-3 active:scale-97"
      >
        <ShieldAlertIcon aria-hidden className="size-4" />
        <span aria-hidden className="tabular-nums sm:hidden">
          {data.affectedComponents}
        </span>
        <span aria-hidden className="hidden sm:inline">
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <SecurityPillContent onNavigate={() => setOpen(false)} summary={data} />
      </PopoverContent>
    </Popover>
  );
};
