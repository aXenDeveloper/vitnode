import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, RotateCwIcon } from "lucide-react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMoneyFormatter } from "@/views/payments/money-text";
import { PurchaseStateBadge } from "@/views/payments/state-badges";

import type { AdminPurchaseDetail } from "./payments-admin-query";

import {
  paymentsAdminRoot,
  retryFulfillmentRequest,
} from "./payments-admin-query";
import {
  AdminSubscriptionStatusBadge,
  FulfillmentStatusBadge,
  PaymentStatusBadge,
  WorkStatusBadge,
} from "./status-badges";

type JsonDate = Date | null | string;

const useDate = () => {
  const format = useFormatter();

  return (value: JsonDate) =>
    value
      ? format.dateTime(new Date(value), {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";
};

const Field = ({
  label,
  children,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex flex-col gap-1">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="text-sm break-all">{children}</dd>
  </div>
);

const RetryFulfillmentButton = ({ id }: { id: number }) => {
  const t = useTranslations("admin.payments.detail");
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: retryFulfillmentRequest,
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
      isLoading={retry.isPending}
      onClick={() => {
        retry.mutate(id);
      }}
      size="sm"
      variant="outline"
    >
      <RotateCwIcon aria-hidden="true" />
      {t("retry")}
    </Button>
  );
};

export const PurchaseDetailContent = ({
  canRetry,
  data,
}: {
  canRetry: boolean;
  data: AdminPurchaseDetail;
}) => {
  const t = useTranslations("admin.payments");
  const tCore = useTranslations("core.payments");
  const date = useDate();
  const formatMoney = useMoneyFormatter();
  const { purchase, subscription } = data;
  const money = (amount: number, currency = purchase.currency) =>
    formatMoney({ amount, currency });

  return (
    <div className="flex flex-col gap-4">
      <Button
        className="self-start"
        render={<Link to="/admin/core/payments" />}
        size="sm"
        variant="ghost"
      >
        <ArrowLeftIcon aria-hidden="true" />
        {t("detail.back")}
      </Button>

      {data.offerRegistered ? null : (
        <Alert variant="warning">
          <AlertDescription>{t("detail.offer_missing")}</AlertDescription>
        </Alert>
      )}

      {purchase.lastError ? (
        <Alert variant="destructive">
          <AlertDescription className="break-words">
            {t("detail.last_error")}: {purchase.lastError}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {purchase.offerName}
            <PurchaseStateBadge state={purchase.displayState} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("purchases.amount")}>
              <span className="tabular-nums">{money(purchase.amount)}</span>
              {purchase.interval
                ? ` · ${tCore(`interval.${purchase.interval}`)}`
                : null}
            </Field>
            <Field label={t("purchases.status")}>
              <PaymentStatusBadge status={purchase.paymentStatus} />
            </Field>
            <Field label={t("purchases.fulfillment")}>
              <FulfillmentStatusBadge status={purchase.fulfillmentStatus} />
            </Field>
            <Field label={t("overview.refunded")}>
              <span className="tabular-nums">
                {money(purchase.refundedAmount)} ·{" "}
                {t(`refund_status.${purchase.refundStatus}`)}
              </span>
            </Field>
            <Field label={t("purchases.buyer")}>
              {purchase.user?.name ?? t("purchases.deleted_user")}
            </Field>
            <Field label={t("purchases.created")}>
              {date(purchase.createdAt)}
            </Field>
            <Field label={t("purchases.provider")}>
              {purchase.provider} ({purchase.providerScope})
            </Field>
            <Field label={t("detail.references")}>
              {[data.externalPaymentId, data.externalCustomerId]
                .filter(Boolean)
                .join(" · ") || t("detail.none")}
            </Field>
            <Field label={purchase.pluginId}>{purchase.offerId}</Field>
          </dl>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>{t("detail.fulfillments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.fulfillments.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("detail.none")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("detail.effect")}</TableHead>
                    <TableHead>{t("events.status")}</TableHead>
                    <TableHead>{t("detail.attempts")}</TableHead>
                    <TableHead>{t("detail.last_error")}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t("detail.retry")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.fulfillments.map(fulfillment => (
                    <TableRow key={fulfillment.id}>
                      <TableCell>
                        <code className="text-xs">{fulfillment.effect}</code>
                      </TableCell>
                      <TableCell>
                        <WorkStatusBadge
                          kind="work"
                          status={fulfillment.status}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {fulfillment.attempts}
                      </TableCell>
                      <TableCell className="max-w-sm whitespace-normal">
                        <span className="text-destructive text-sm">
                          {fulfillment.lastError ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {canRetry &&
                        fulfillment.retryable &&
                        fulfillment.status === "failed" ? (
                          <RetryFulfillmentButton id={fulfillment.id} />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {subscription ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {t("detail.subscription")}
              <AdminSubscriptionStatusBadge status={subscription.status} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("subscriptions.price")}>
                <span className="tabular-nums">
                  {tCore(`per_interval.${subscription.interval}`, {
                    price: money(subscription.amount, subscription.currency),
                  })}
                </span>
              </Field>
              <Field label={t("subscriptions.paid_through")}>
                {date(subscription.paidThrough)}
              </Field>
              <Field label={tCore("subscription_state.cancellation_scheduled")}>
                {subscription.cancelAtPeriodEnd
                  ? date(subscription.cancelAt)
                  : "—"}
              </Field>
              <Field label={t("detail.references")}>
                {subscription.externalId} · {subscription.providerStatus}
              </Field>
              <Field label={t("events.received")}>
                {date(subscription.syncedAt)}
              </Field>
              {subscription.lastError ? (
                <Field label={t("detail.last_error")}>
                  {subscription.lastError}
                </Field>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {data.invoices.length > 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("detail.invoices")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("detail.period")}</TableHead>
                  <TableHead>{t("purchases.amount")}</TableHead>
                  <TableHead>{t("purchases.status")}</TableHead>
                  <TableHead>{t("overview.refunded")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map(invoice => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {date(invoice.periodStart)} – {date(invoice.periodEnd)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {money(
                        invoice.amountPaid || invoice.amountDue,
                        invoice.currency,
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{invoice.status}</code>
                      {invoice.disputeStatus
                        ? ` · ${t("detail.dispute")}`
                        : null}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {money(invoice.refundedAmount, invoice.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("detail.adjustments")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.adjustments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("detail.none")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {data.adjustments.map(adjustment => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2"
                    key={`${adjustment.kind}-${adjustment.externalId}`}
                  >
                    <span>
                      {t(`detail.${adjustment.kind}`)} ·{" "}
                      <code className="text-xs">{adjustment.status}</code>
                      {adjustment.reason ? ` · ${adjustment.reason}` : null}
                    </span>
                    <span className="tabular-nums">
                      {money(adjustment.amount, adjustment.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("detail.checkouts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {data.checkouts.map(checkout => (
                <li
                  className="flex flex-col gap-1"
                  key={`${checkout.createdAt.toString()}-${checkout.status}`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <code className="text-xs">{checkout.status}</code>
                    <span className="text-muted-foreground">
                      {date(checkout.createdAt)}
                    </span>
                  </span>
                  {checkout.externalId ? (
                    <code className="text-muted-foreground text-xs break-all">
                      {checkout.externalId}
                    </code>
                  ) : null}
                  {checkout.lastError ? (
                    <span className="text-destructive">
                      {checkout.lastError}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
