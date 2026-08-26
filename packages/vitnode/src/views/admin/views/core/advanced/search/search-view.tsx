import {
  ClockIcon,
  DatabaseIcon,
  LayersIcon,
  ShieldCheckIcon,
  ShieldXIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { DateFormat } from "@/components/date-format";
import { DataTableSkeleton } from "@/components/table/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";

import { getContentCollectionLabels } from "./collection-label";
import { CollectionsTable } from "./collections-table";
import { CronWarning } from "./cron-warning";
import { SyncErrorsCard } from "./sync-errors-card";

const getStatus = async () => {
  const res = await fetcher(debugAdminModule, {
    prefixPath: "/admin",
    path: "/search/status",
    method: "get",
    module: "debug",
  });

  return res.json();
};

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

export const SearchAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) => {
  const [t, data, query] = await Promise.all([
    getTranslations("core.search"),
    getStatus(),
    searchParams,
  ]);

  const labels = await getContentCollectionLabels();

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

      <SyncErrorsCard errors={data.syncErrors} labels={labels} />

      <CollectionsTable
        collections={data.collections}
        labels={labels}
        search={query.search}
      />
    </div>
  );
};

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
