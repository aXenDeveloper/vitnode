import { cn } from "cn";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";

import type { CronJobRow, CronPage } from "./cron-query";
import type { RunCron } from "./run-action/run-cron";

import { RunActionCronTable } from "./run-action/run-action";

type CronJobStatus = "on_schedule" | "overdue" | "waiting";

const jobStatus = (row: CronJobRow): CronJobStatus => {
  if (row.overdue) return "overdue";
  if (!row.lastRun) return "waiting";

  return "on_schedule";
};

const STATUS_DOT: Record<CronJobStatus, string> = {
  on_schedule: "bg-success",
  overdue: "bg-warn",
  waiting: "bg-muted-foreground/50",
};

export const CronTableContent = ({
  data,
  onRun,
}: {
  data: CronPage;
  onRun: RunCron;
}) => {
  const t = useTranslations("admin.advanced.cron");

  return (
    <ContentDataTable<CronJobRow>
      columns={[
        {
          accessorKey: "name",
          header: t("list.name"),
          cell: ({ row }) => (
            <div className="flex max-w-sm flex-col">
              <span className="truncate">{row.name}</span>
              <p
                className="text-muted-foreground line-clamp-2 text-sm whitespace-normal"
                title={row.description ?? undefined}
              >
                {row.description}
              </p>
            </div>
          ),
        },
        {
          id: "status",
          header: t("list.status.title"),
          cell: ({ row }) => {
            const status = jobStatus(row);

            return (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    STATUS_DOT[status],
                  )}
                />
                <span
                  className={cn(
                    status === "overdue"
                      ? "text-warn"
                      : "text-muted-foreground",
                  )}
                >
                  {t(`list.status.${status}`)}
                </span>
              </span>
            );
          },
        },
        {
          accessorKey: "pluginId",
          header: t("list.plugin"),
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span>{row.pluginId}</span>
              <span className="text-muted-foreground text-sm">
                {row.module}
              </span>
            </div>
          ),
        },
        {
          accessorKey: "schedule",
          header: t("list.schedule"),
          cell: ({ row }) => (
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
              {row.schedule}
            </code>
          ),
        },
        {
          accessorKey: "lastRun",
          header: t("list.lastRun.title"),
          cell: ({ row }) =>
            row.lastRun ? (
              <DateFormat date={row.lastRun} />
            ) : (
              <span className="text-muted-foreground italic">
                {t("list.lastRun.never")}
              </span>
            ),
        },
        {
          accessorKey: "nextRun",
          header: t("list.nextRun.title"),
          cell: ({ row }) =>
            row.nextRun ? (
              <DateFormat date={row.nextRun} showFullDate />
            ) : (
              <span className="text-muted-foreground italic">
                {t("list.nextRun.never")}
              </span>
            ),
        },
        {
          id: "actions",
          header: "",
          align: "right",
          cell: ({ row }) => <RunActionCronTable id={row.id} onRun={onRun} />,
        },
      ]}
      edges={data.edges}
      id="cron-table"
      order={{
        columns: ["lastRun", "createdAt", "nextRun"],
        defaultOrder: {
          column: "lastRun",
          order: "desc",
        },
      }}
      pageInfo={data.pageInfo}
      search
      searchPlaceholder={t("list.search")}
    />
  );
};
