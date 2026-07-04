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
          id: "name",
          label: t("list.name"),
          cell: ({ row }) => (
            <div className="flex max-w-sm flex-col">
              <span>{row.name}</span>
              <p className="text-muted-foreground text-sm">{row.pluginId}</p>
            </div>
          ),
        },
        { id: "queue", label: t("list.queue") },
        {
          id: "status",
          label: t("list.status"),
          cell: ({ row }) => <QueueStatusBadge status={row.status} />,
        },
        {
          id: "attempts",
          label: t("list.attempts"),
          cell: ({ row }) => `${row.attempts}/${row.maxAttempts}`,
        },
        {
          id: "availableAt",
          label: t("list.availableAt"),
          cell: ({ row }) => <DateFormat date={row.availableAt} showFullDate />,
        },
        {
          id: "createdAt",
          label: t("list.createdAt"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
        },
        {
          id: "lastError",
          label: t("list.lastError"),
          cell: ({ row }) =>
            row.lastError ? (
              <span className="text-destructive line-clamp-2 max-w-xs text-sm">
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
