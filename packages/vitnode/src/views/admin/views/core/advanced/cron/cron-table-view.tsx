import { getTranslations } from "next-intl/server";

import { cronAdminModule } from "@/api/modules/admin/advanced/cron/cron.admin.module";
import { DateFormat } from "@/components/date-format";
import {
  DataTable,
  type SearchParamsDataTable,
} from "@/components/table/data-table";
import { fetcher } from "@/lib/fetcher";

import { RunActionCronTable } from "./run-action/run-action";

export const CronTableView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsDataTable>;
}) => {
  const query = await searchParams;
  const res = await fetcher(cronAdminModule, {
    path: "/",
    method: "get",
    module: "cron",
    prefixPath: "/admin/advanced",
    args: {
      query,
    },
    withPagination: true,
  });

  const [data, t] = await Promise.all([
    res.json(),
    getTranslations("admin.advanced.cron"),
  ]);

  return (
    <DataTable
      columns={[
        {
          accessorKey: "name",
          header: t("list.name"),
          cell: ({ row }) => (
            <div className="flex max-w-sm flex-col">
              <span>{row.name}</span>
              <p className="text-muted-foreground text-sm">{row.description}</p>
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
          cell: ({ row }) => <RunActionCronTable id={row.id} />,
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
