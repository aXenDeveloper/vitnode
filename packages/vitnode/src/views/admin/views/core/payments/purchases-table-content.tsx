import { Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import type { AdminTablePage } from "@/views/admin/table/params";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";
import { PURCHASE_PAYMENT_STATUSES } from "@/payments/status";
import { MoneyText } from "@/views/payments/money-text";

import type { AdminPurchaseRow } from "./payments-admin-query";

import { usePaymentFilters } from "./filters";
import { FULFILLMENT_STATUSES } from "./payments-admin-query";
import { FulfillmentStatusBadge, PaymentStatusBadge } from "./status-badges";

export const PurchasesTableContent = ({
  currencies,
  data,
  providers,
}: {
  currencies: string[];
  data: AdminTablePage<AdminPurchaseRow>;
  providers: string[];
}) => {
  const t = useTranslations("admin.payments");
  const tStatus = useTranslations("admin.payments.payment_status");
  const tFulfillment = useTranslations("admin.payments.fulfillment_status");
  const common = usePaymentFilters({ currencies, providers });

  return (
    <ContentDataTable<AdminPurchaseRow>
      columns={[
        {
          accessorKey: "offerName",
          header: t("purchases.offer"),
          cell: ({ row }) => (
            <div className="flex max-w-xs flex-col">
              <Link
                className="truncate font-medium underline-offset-4 hover:underline"
                params={{ id: row.publicId }}
                to="/admin/core/payments/purchases/$id"
              >
                {row.offerName}
              </Link>
              <span className="text-muted-foreground truncate text-xs">
                {row.pluginId}
              </span>
            </div>
          ),
        },
        {
          accessorKey: "user",
          header: t("purchases.buyer"),
          cell: ({ row }) =>
            row.user ? (
              <Link
                className="underline-offset-4 hover:underline"
                params={{ id: String(row.user.id) }}
                to="/admin/core/users/$id"
              >
                {row.user.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">
                {t("purchases.deleted_user")}
              </span>
            ),
        },
        {
          accessorKey: "amount",
          header: t("purchases.amount"),
          cell: ({ row }) => (
            <MoneyText amount={row.amount} currency={row.currency} />
          ),
        },
        {
          accessorKey: "paymentStatus",
          header: t("purchases.status"),
          cell: ({ row }) => <PaymentStatusBadge status={row.paymentStatus} />,
        },
        {
          accessorKey: "fulfillmentStatus",
          header: t("purchases.fulfillment"),
          cell: ({ row }) => (
            <FulfillmentStatusBadge status={row.fulfillmentStatus} />
          ),
        },
        {
          accessorKey: "provider",
          header: t("purchases.provider"),
          cell: ({ row }) => `${row.provider} (${row.providerScope})`,
        },
        {
          accessorKey: "createdAt",
          header: t("purchases.created"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
        },
      ]}
      edges={data.edges}
      filters={[
        {
          id: "status",
          label: t("filters.status"),
          options: PURCHASE_PAYMENT_STATUSES.map(status => ({
            label: tStatus(status),
            value: status,
          })),
        },
        {
          id: "fulfillment",
          label: t("filters.fulfillment"),
          options: FULFILLMENT_STATUSES.map(status => ({
            label: tFulfillment(status),
            value: status,
          })),
        },
        ...common,
      ]}
      id="payments-purchases-table"
      order={{
        columns: ["createdAt", "amount"],
        defaultOrder: { column: "createdAt", order: "desc" },
      }}
      pageInfo={data.pageInfo}
    />
  );
};
