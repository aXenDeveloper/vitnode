import {
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { CreditCardIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageTitle } from "@/components/ui/page-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { Purchase, Subscription } from "../payments-query";

import { MoneyText, useMoneyFormatter } from "../money-text";
import {
  paymentsSettingsQueryOptions,
  purchasesQueryOptions,
  subscriptionsQueryOptions,
} from "../payments-query";
import { PurchaseStateBadge, SubscriptionStateBadge } from "../state-badges";
import { useBillingPortal } from "../use-checkout";

const toDate = (value: Date | string) =>
  typeof value === "string" ? new Date(value) : value;

const SubscriptionItem = ({
  canManage,
  onManage,
  isManaging,
  subscription,
}: {
  canManage: boolean;
  isManaging: boolean;
  onManage: () => void;
  subscription: Subscription;
}) => {
  const t = useTranslations("core.payments");
  const format = useFormatter();
  const formatMoney = useMoneyFormatter();
  const date = (value: Date | string) =>
    format.dateTime(toDate(value), { dateStyle: "long" });
  const ended = subscription.displayState === "ended";

  return (
    <li>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {subscription.offerName}
            <SubscriptionStateBadge state={subscription.displayState} />
          </CardTitle>
          <CardDescription className="leading-relaxed tabular-nums">
            {t(`per_interval.${subscription.interval}`, {
              price: formatMoney(subscription),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">
          {subscription.displayState === "needs_attention" ? (
            <Alert variant="warning">
              <AlertDescription>
                {t("billing.subscriptions.attention")}
              </AlertDescription>
            </Alert>
          ) : null}
          <dl className="grid gap-1 sm:grid-cols-2">
            {subscription.paidThrough ? (
              <div>
                <dt className="sr-only">{t("billing.subscriptions.title")}</dt>
                <dd>
                  {t("billing.subscriptions.paid_through", {
                    date: date(subscription.paidThrough),
                  })}
                </dd>
              </div>
            ) : null}
            {!ended && subscription.currentPeriodEnd ? (
              <div>
                <dt className="sr-only">{t("billing.subscriptions.title")}</dt>
                <dd>
                  {t(
                    subscription.cancelAtPeriodEnd
                      ? "billing.subscriptions.ends"
                      : "billing.subscriptions.renews",
                    { date: date(subscription.currentPeriodEnd) },
                  )}
                </dd>
              </div>
            ) : null}
            {ended && subscription.endedAt ? (
              <div>
                <dt className="sr-only">{t("billing.subscriptions.title")}</dt>
                <dd>
                  {t("billing.subscriptions.ended", {
                    date: date(subscription.endedAt),
                  })}
                </dd>
              </div>
            ) : null}
          </dl>
          {canManage && !ended ? (
            <div>
              <Button
                isLoading={isManaging}
                onClick={onManage}
                size="sm"
                variant="outline"
              >
                <ExternalLinkIcon aria-hidden="true" />
                {t("billing.manage")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
};

const PurchaseRow = ({ purchase }: { purchase: Purchase }) => {
  const t = useTranslations("core.payments.billing.purchases");
  const format = useFormatter();
  const formatMoney = useMoneyFormatter();

  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <span className="font-medium">{purchase.offerName}</span>
      </TableCell>
      <TableCell>
        <time dateTime={toDate(purchase.createdAt).toISOString()}>
          {format.dateTime(toDate(purchase.createdAt), { dateStyle: "medium" })}
        </time>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <MoneyText amount={purchase.amount} currency={purchase.currency} />
          {purchase.refundedAmount > 0 ? (
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("refunded", {
                amount: formatMoney({
                  amount: purchase.refundedAmount,
                  currency: purchase.currency,
                }),
              })}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <PurchaseStateBadge state={purchase.displayState} />
      </TableCell>
    </TableRow>
  );
};

export const BillingContent = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.payments.billing");
  const { data: settings } = useSuspenseQuery(paymentsSettingsQueryOptions());
  const purchases = useSuspenseInfiniteQuery(purchasesQueryOptions({ userId }));
  const subscriptions = useSuspenseInfiniteQuery(
    subscriptionsQueryOptions({ userId }),
  );
  const portal = useBillingPortal();

  const purchaseRows = purchases.data.pages.flatMap(page => page.edges);
  const subscriptionRows = subscriptions.data.pages.flatMap(page => page.edges);
  const portalProviders = new Set(
    settings.providers
      .filter(provider => provider.capabilities.customerPortal)
      .map(provider => provider.id),
  );

  const manage = () => {
    portal.mutate(undefined, {
      onError: error => {
        toast.error(t("portal_error"), { description: error.message });
      },
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <PageTitle className="mb-0" desc={t("desc")} h1={t("title")} />

      <section
        aria-labelledby="billing-subscriptions"
        className="flex flex-col gap-3"
      >
        <h2
          className="text-lg font-semibold tracking-tight text-balance"
          id="billing-subscriptions"
        >
          {t("subscriptions.title")}
        </h2>
        {subscriptionRows.length === 0 ? (
          <p className="text-muted-foreground leading-relaxed">
            {t("subscriptions.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {subscriptionRows.map(subscription => (
              <SubscriptionItem
                canManage={portalProviders.has(subscription.provider)}
                isManaging={portal.isPending}
                key={subscription.id}
                onManage={manage}
                subscription={subscription}
              />
            ))}
          </ul>
        )}
        {subscriptions.hasNextPage ? (
          <Button
            className="self-start"
            isLoading={subscriptions.isFetchingNextPage}
            onClick={() => void subscriptions.fetchNextPage()}
            variant="outline"
          >
            {t("subscriptions.more")}
          </Button>
        ) : null}
      </section>

      <section
        aria-labelledby="billing-purchases"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            className="text-lg font-semibold tracking-tight text-balance"
            id="billing-purchases"
          >
            {t("purchases.title")}
          </h2>
          {portalProviders.size > 0 && purchaseRows.length > 0 ? (
            <Button
              isLoading={portal.isPending}
              onClick={manage}
              size="sm"
              variant="ghost"
            >
              <CreditCardIcon aria-hidden="true" />
              {t("manage")}
            </Button>
          ) : null}
        </div>
        {purchaseRows.length === 0 ? (
          <p className="text-muted-foreground leading-relaxed">
            {t("purchases.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("purchases.item")}</TableHead>
                  <TableHead>{t("purchases.date")}</TableHead>
                  <TableHead>{t("purchases.amount")}</TableHead>
                  <TableHead>{t("purchases.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseRows.map(purchase => (
                  <PurchaseRow key={purchase.id} purchase={purchase} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {purchases.hasNextPage ? (
          <Button
            className="self-start"
            isLoading={purchases.isFetchingNextPage}
            onClick={() => void purchases.fetchNextPage()}
            variant="outline"
          >
            {t("purchases.more")}
          </Button>
        ) : null}
      </section>

      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("tax_note")}
      </p>
    </div>
  );
};
