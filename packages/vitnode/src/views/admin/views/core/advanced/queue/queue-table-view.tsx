import { getTranslations } from "next-intl/server";

import { queueAdminModule } from "@/api/modules/admin/advanced/queue/queue.admin.module";
import { DateFormat } from "@/components/date-format";
import {
  DataTable,
  type SearchParamsDataTable,
} from "@/components/table/data-table";
import { fetcher } from "@/lib/fetcher";

import { QueueStatusBadge } from "./badges/status-badge";

const QUEUE_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export const QueueTableView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsDataTable & { status?: string }>;
}) => {
  const query = await searchParams;
  const res = await fetcher(queueAdminModule, {
    path: "/",
    method: "get",
    module: "queue",
    prefixPath: "/admin/advanced",
    args: {
      query,
    },
    withPagination: true,
  });

  const [data, t] = await Promise.all([
    res.json(),
    getTranslations("admin.advanced.queue"),
  ]);

  return (
    <DataTable
      columns={[
        {
          accessorKey: "name",
          header: t("list.name"),
          cell: ({ row }) => (
            <div className="flex max-w-sm flex-col">
              <span className="truncate">{row.name}</span>
              <p className="text-muted-foreground truncate text-sm">
                {row.pluginId}
              </p>
            </div>
          ),
        },
        { accessorKey: "queue", header: t("list.queue") },
        {
          accessorKey: "status",
          header: t("list.status"),
          cell: ({ row }) => <QueueStatusBadge status={row.status} />,
        },
        {
          accessorKey: "attempts",
          header: t("list.attempts"),
          cell: ({ row }) => `${row.attempts}/${row.maxAttempts}`,
        },
        {
          accessorKey: "availableAt",
          header: t("list.availableAt"),
          cell: ({ row }) => <DateFormat date={row.availableAt} showFullDate />,
        },
        {
          accessorKey: "createdAt",
          header: t("list.createdAt"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
        },
        {
          accessorKey: "lastError",
          header: t("list.lastError"),
          cell: ({ row }) =>
            row.lastError ? (
              <span
                className="text-destructive line-clamp-2 max-w-xs text-sm whitespace-normal"
                title={row.lastError}
              >
                {row.lastError}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
      ]}
      edges={data.edges}
      filters={[
        {
          id: "status",
          label: t("list.statusFilter"),
          options: QUEUE_STATUSES.map(status => ({
            value: status,
            label: t(`status.${status}`),
          })),
        },
      ]}
      id="queue-table"
      order={{
        columns: ["createdAt", "availableAt", "status"],
        defaultOrder: {
          column: "createdAt",
          order: "desc",
        },
      }}
      pageInfo={data.pageInfo}
    />
  );
};
