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
          id: "name",
          label: t("list.name"),
          cell: ({ row }) => (
            <div className="flex flex-col max-w-sm">
              <span>{row.name}</span>
              <p className="text-sm text-muted-foreground">{row.description}</p>
            </div>
          ),
        },
        { id: "pluginId", label: t("list.pluginId") },
        { id: "module", label: t("list.module") },
        {
          id: "schedule",
          label: t("list.schedule"),
        },
        {
          id: "lastRun",
          label: t("list.lastRun.title"),
          cell: ({ row }) =>
            row.lastRun ? (
              <DateFormat date={row.lastRun} />
            ) : (
              <span className="italic text-muted-foreground">
                {t("list.lastRun.never")}
              </span>
            ),
        },
        {
          id: "nextRun",
          label: t("list.nextRun.title"),
          cell: ({ row }) =>
            row.nextRun ? (
              <DateFormat date={row.nextRun} showFullDate />
            ) : (
              <span className="italic text-muted-foreground">
                {t("list.nextRun.never")}
              </span>
            ),
        },
        {
          id: "actions",
          label: "",
          cell: ({ row }) => <RunActionCronTable id={row.id} />,
        },
      ]}
      edges={data.edges}
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
