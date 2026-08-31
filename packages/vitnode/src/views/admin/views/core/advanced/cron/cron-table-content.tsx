"use client";

import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";

import type { CronJobRow, CronPage } from "./cron-query";
import type { RunCron } from "./run-action/run-cron";

import { RunActionCronTable } from "./run-action/run-action";

/**
 * The cron list, as a table both frameworks render.
 *
 * Everything that used to make this a Next.js Server Component has been taken
 * out and turned into a parameter: it no longer fetches and no longer calls
 * `getTranslations`. What is left is the part that was always worth sharing -
 * the seven columns, the relative dates, the "never" states and which columns
 * are sortable.
 *
 *     Next.js         cron-table-view.tsx           fetch + server action
 *     TanStack Start  routes/_admin/…/advanced/cron  loader + useSuspenseQuery + browser run
 *                                     \       /
 *                                CronTableContent
 *
 * `ContentDataTable` rather than `DataTable`: `DataTable` *is* the Next.js
 * wiring, and the caller mounts the navigation seam it needs
 * (`NextDataTableNavigation` there, `DataTableNavigationProvider` here).
 *
 * The one thing this costs Next.js is `"use client"`, so the `cell` functions
 * run in the browser rather than on the server. It is close to free on this
 * table: `DateFormat` and the run button were already client components, so the
 * only thing that newly reaches the browser is the column list. The rendered
 * HTML is unchanged - Next.js server-renders client components too.
 */
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
        { accessorKey: "pluginId", header: t("list.pluginId") },
        { accessorKey: "module", header: t("list.module") },
        {
          accessorKey: "schedule",
          header: t("list.schedule"),
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
    />
  );
};
