"use client";

import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";

import type { QueuePage, QueueTaskRow } from "./queue-query";

import { QueueStatusBadge } from "./badges/status-badge";
import { QUEUE_STATUSES } from "./queue-query";

/**
 * The queue list, as a table both frameworks render.
 *
 * The seven columns, the status badge, the attempt counter, the truncated last
 * error and the status filter - all of it shared, with fetching and translation
 * lifted out to whoever is rendering it.
 *
 *     Next.js         queue-table-view.tsx           fetch
 *     TanStack Start  routes/_admin/…/advanced/queue  loader + useSuspenseQuery
 *                                     \       /
 *                                QueueTableContent
 *
 * `ContentDataTable` rather than `DataTable`, because `DataTable` *is* the
 * Next.js wiring; the caller mounts the navigation seam it needs.
 */
export const QueueTableContent = ({ data }: { data: QueuePage }) => {
  const t = useTranslations("admin.advanced.queue");

  return (
    <ContentDataTable<QueueTaskRow>
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
