import { Link } from "@tanstack/react-router";
import { useFormatter, useTranslations } from "use-intl";

import type { AdminTablePage } from "@/views/admin/table/params";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";
import { SUBSCRIPTION_STATUSES } from "@/payments/status";
import { useMoneyFormatter } from "@/views/payments/money-text";

import type { AdminSubscriptionRow } from "./payments-admin-query";

import { usePaymentFilters } from "./filters";
import { AdminSubscriptionStatusBadge } from "./status-badges";

export const SubscriptionsTableContent = ({
  currencies,
  data,
  providers,
}: {
  currencies: string[];
  data: AdminTablePage<AdminSubscriptionRow>;
  providers: string[];
}) => {
  const t = useTranslations("admin.payments");
  const tStatus = useTranslations("admin.payments.subscription_status");
  const tCore = useTranslations("core.payments");
  const format = useFormatter();
  const formatMoney = useMoneyFormatter();
  const common = usePaymentFilters({ currencies, providers });

  return (
    <ContentDataTable<AdminSubscriptionRow>
      columns={[
        {
          accessorKey: "offerName",
          header: t("subscriptions.plan"),
          cell: ({ row }) => (
            <Link
              className="font-medium underline-offset-4 hover:underline"
              params={{ id: row.purchaseId }}
              to="/admin/core/payments/purchases/$id"
            >
              {row.offerName}
            </Link>
          ),
        },
        {
          accessorKey: "user",
          header: t("subscriptions.subscriber"),
          cell: ({ row }) =>
            row.user?.name ?? (
              <span className="text-muted-foreground">
                {t("purchases.deleted_user")}
              </span>
            ),
        },
        {
          accessorKey: "amount",
          header: t("subscriptions.price"),
          cell: ({ row }) => (
            <span className="tabular-nums">
              {tCore(`per_interval.${row.interval}`, {
                price: formatMoney(row),
              })}
            </span>
          ),
        },
        {
          accessorKey: "status",
          header: t("subscriptions.status"),
          cell: ({ row }) => (
            <div className="flex flex-col items-start gap-1">
              <AdminSubscriptionStatusBadge status={row.status} />
              {row.cancelAtPeriodEnd ? (
                <span className="text-muted-foreground text-xs">
                  {tCore("subscription_state.cancellation_scheduled")}
                </span>
              ) : null}
            </div>
          ),
        },
        {
          accessorKey: "paidThrough",
          header: t("subscriptions.paid_through"),
          cell: ({ row }) =>
            row.paidThrough
              ? format.dateTime(new Date(row.paidThrough), {
                  dateStyle: "medium",
                })
              : "—",
        },
        {
          accessorKey: "createdAt",
          header: t("subscriptions.created"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
        },
      ]}
      edges={data.edges}
      filters={[
        {
          id: "status",
          label: t("filters.status"),
          options: SUBSCRIPTION_STATUSES.map(status => ({
            label: tStatus(status),
            value: status,
          })),
        },
        ...common,
      ]}
      id="payments-subscriptions-table"
      order={{
        columns: ["createdAt", "paidThrough"],
        defaultOrder: { column: "createdAt", order: "desc" },
      }}
      pageInfo={data.pageInfo}
    />
  );
};
