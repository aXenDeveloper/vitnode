"use client";

import {
  ClockIcon,
  DatabaseIcon,
  LayersIcon,
  ShieldCheckIcon,
  ShieldXIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { DataTableSkeleton } from "@/components/table/data-table-content";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { SearchIndexActions } from "./search-index-mutations";
import type { SearchIndexStatus } from "./search-index-query";

import { CollectionsTableContent } from "./collections-table-content";
import { CronWarning } from "./cron-warning";
import { SyncErrorsCardContent } from "./sync-errors-card-content";

/**
 * The search index screen's body, as both frameworks render it.
 *
 * Four stat cards, the cron warning, the sync-error list and the collections
 * table. Fetching and translation are lifted out; the two mutations arrive as
 * `actions`, each carrying its own refresh.
 *
 *     Next.js         search-view.tsx                    fetch + router.refresh()
 *     TanStack Start  routes/_admin/…/advanced/search     loader + query invalidation
 *                                        \       /
 *                                 SearchIndexContent
 *
 * `labels` names the collections a Content Engine content type contributes.
 * Resolved from the *frontend* content-type registry, which is server-side
 * config: the Next.js page reads it directly, and a TanStack Start host passes
 * it only if it has a browser-side registry - which in Stage 12 it does not, so
 * those collections fall back to the search renderer's own label. Optional for
 * exactly that reason, and never silently wrong: an unnamed collection still
 * shows its `itemType`.
 */

const StatCard = ({
  accent,
  icon,
  label,
  sublabel,
  value,
}: {
  accent: string;
  icon: React.ReactNode;
  label: string;
  sublabel: React.ReactNode;
  value: React.ReactNode;
}) => (
  <Card>
    <CardContent className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4",
            accent,
          )}
        >
          {icon}
        </span>
        <span className="text-muted-foreground text-sm font-medium">
          {label}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-foreground text-2xl font-bold text-balance">
          {value}
        </div>
        <div className="text-muted-foreground text-sm">{sublabel}</div>
      </div>
    </CardContent>
  </Card>
);

export const SearchIndexContent = ({
  actions,
  data,
  labels,
  search,
}: {
  actions: SearchIndexActions;
  data: SearchIndexStatus;
  labels?: Map<string, string>;
  search?: string;
}) => {
  const t = useTranslations("core.search");

  return (
    <div className="flex flex-col gap-6">
      {!data.hasCronAdapter && <CronWarning />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent={
            data.healthy
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          }
          icon={data.healthy ? <ShieldCheckIcon /> : <ShieldXIcon />}
          label={t("admin.stats.status")}
          sublabel={t(
            data.healthy
              ? "admin.stats.statusHealthy"
              : "admin.stats.statusUnhealthy",
          )}
          value={t(data.healthy ? "admin.healthy" : "admin.unhealthy")}
        />

        <StatCard
          accent="bg-primary/10 text-primary"
          icon={<DatabaseIcon />}
          label={t("admin.stats.engine")}
          sublabel={t("admin.stats.engineDesc")}
          value={<span className="capitalize">{data.engine}</span>}
        />

        <StatCard
          accent="bg-muted text-muted-foreground"
          icon={<LayersIcon />}
          label={t("admin.stats.indexed")}
          sublabel={t("admin.stats.indexedDesc", {
            count: data.collections.length,
          })}
          value={<span className="tabular-nums">{data.total}</span>}
        />

        <StatCard
          accent="bg-muted text-muted-foreground"
          icon={<ClockIcon />}
          label={t("admin.stats.lastIndexed")}
          sublabel={
            data.lastIndexedAt ? (
              <DateFormat date={data.lastIndexedAt} showFullDate />
            ) : (
              t("admin.stats.lastIndexedNever")
            )
          }
          value={
            data.lastIndexedAt ? (
              <DateFormat date={data.lastIndexedAt} />
            ) : (
              t("admin.never")
            )
          }
        />
      </div>

      <SyncErrorsCardContent errors={data.syncErrors} labels={labels} />

      <CollectionsTableContent
        actions={actions}
        collections={data.collections}
        labels={labels}
        search={search}
      />
    </div>
  );
};

/**
 * The screen's shape before its data arrives.
 *
 * Framework-free and beside the screen rather than inside it, because a Suspense
 * fallback is rendered *outside* the component it stands in for - the Next.js
 * page mounts it above `<SearchAdminView>`.
 */
export const SearchAdminViewSkeleton = () => (
  <div className="flex flex-col gap-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {["status", "engine", "indexed", "last-indexed"].map(key => (
        <Skeleton className="h-32 w-full rounded-xl" key={key} />
      ))}
    </div>
    <Card>
      <CardContent>
        <DataTableSkeleton columns={5} toolbar />
      </CardContent>
    </Card>
  </div>
);
