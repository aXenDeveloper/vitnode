import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminTablePage } from "@/views/admin/table/params";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";
import { Button } from "@/components/ui/button";

import type { AdminWebhookEventRow } from "./payments-admin-query";

import {
  EVENTS_TABLE_CONTRACT,
  paymentsAdminRoot,
  retryWebhookEventRequest,
} from "./payments-admin-query";
import { WorkStatusBadge } from "./status-badges";

const RetryEventButton = ({ event }: { event: AdminWebhookEventRow }) => {
  const t = useTranslations("admin.payments.events");
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: retryWebhookEventRequest,
    onError: error => {
      toast.error(t("retry_error"), { description: error.message });
    },
    onSuccess: async () => {
      toast.success(t("retried"), { description: t("retried_desc") });
      await queryClient.invalidateQueries({ queryKey: paymentsAdminRoot });
    },
  });

  return (
    <Button
      aria-label={`${t("retry")} ${event.type}`}
      isLoading={retry.isPending}
      onClick={() => {
        retry.mutate(event.id);
      }}
      size="sm"
      variant="outline"
    >
      <RotateCwIcon aria-hidden="true" />
      {t("retry")}
    </Button>
  );
};

export const EventsTableContent = ({
  canRetry,
  data,
}: {
  canRetry: boolean;
  data: AdminTablePage<AdminWebhookEventRow>;
}) => {
  const t = useTranslations("admin.payments");
  const tStatus = useTranslations("admin.payments.event_status");

  return (
    <ContentDataTable<AdminWebhookEventRow>
      columns={[
        {
          accessorKey: "type",
          header: t("events.type"),
          cell: ({ row }) => (
            <div className="flex max-w-xs flex-col">
              <span className="truncate font-medium">{row.type}</span>
              <span className="text-muted-foreground truncate text-xs">
                {row.provider} ({row.providerScope}) · {row.externalId}
              </span>
            </div>
          ),
        },
        {
          accessorKey: "targetId",
          header: t("events.target"),
          cell: ({ row }) => (
            <span className="text-sm">
              {row.targetKind}: <code className="text-xs">{row.targetId}</code>
            </span>
          ),
        },
        {
          accessorKey: "status",
          header: t("events.status"),
          cell: ({ row }) => (
            <WorkStatusBadge kind="event" status={row.status} />
          ),
        },
        { accessorKey: "attempts", header: t("events.attempts") },
        {
          accessorKey: "receivedAt",
          header: t("events.received"),
          cell: ({ row }) => <DateFormat date={row.receivedAt} />,
        },
        {
          accessorKey: "lastError",
          header: t("events.error"),
          cell: ({ row }) =>
            row.lastError ? (
              <div className="flex flex-col items-start gap-2">
                <span
                  className="text-destructive line-clamp-2 max-w-xs text-sm whitespace-normal"
                  title={row.lastError}
                >
                  {row.lastError}
                </span>
                {canRetry && row.status === "failed" ? (
                  <RetryEventButton event={row} />
                ) : null}
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
      ]}
      edges={data.edges}
      filters={[
        {
          id: "status",
          label: t("filters.status"),
          options: (EVENTS_TABLE_CONTRACT.status ?? []).map(status => ({
            label: tStatus(status as "failed" | "pending" | "processed"),
            value: status,
          })),
        },
      ]}
      id="payments-events-table"
      order={{
        columns: ["receivedAt"],
        defaultOrder: { column: "receivedAt", order: "desc" },
      }}
      pageInfo={data.pageInfo}
    />
  );
};
