import type { PluginRoutePageProps } from "@vitnode/core/routing";
import type {
  PaymentOfferSummary,
  PaymentsSettings,
  Subscription,
} from "@vitnode/core/tanstack/payments";

import {
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@vitnode/core/components/ui/alert";
import { Badge } from "@vitnode/core/components/ui/badge";
import { Button } from "@vitnode/core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@vitnode/core/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@vitnode/core/components/ui/native-select";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@vitnode/core/components/ui/toggle-group";
import { ensureAuthState, useSessionQuery } from "@vitnode/core/tanstack/auth";
import {
  fetchPurchase,
  isPaymentsRequestError,
  paymentOffersQueryOptions,
  paymentsSettingsQueryOptions,
  subscriptionsQueryOptions,
  SubscriptionStateBadge,
  useBillingPortal,
  useCancelPurchase,
  useMoneyFormatter,
  usePurchaseReturn,
  useStartCheckout,
} from "@vitnode/core/tanstack/payments";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import {
  BadgeCheckIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  LockIcon,
  RefreshCwIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import { CONFIG_PLUGIN } from "@/const";

import type { ExampleOfferId } from "./example-payments-query";
import type { PaymentsSearch } from "./payments-search";

import {
  EXAMPLE_OFFERS,
  exampleAccessQueryOptions,
  exampleAccessRoot,
  exampleFeatureQueryOptions,
} from "./example-payments-query";

interface PaymentsPageData {
  userId: null | number;
}

type Interval = "month" | "year";

const toDate = (value: Date | string) =>
  typeof value === "string" ? new Date(value) : value;

/** Currencies a buyer can choose: enabled ones that at least one offer is priced in. */
const choosableCurrencies = (
  settings: PaymentsSettings,
  offers: PaymentOfferSummary[],
): string[] =>
  settings.currencies
    .map(currency => currency.code)
    .filter(code =>
      offers.some(offer => offer.prices.some(price => price.currency === code)),
    );

const DisabledNotice = () => {
  const t = useTranslations("@vitnode/example.payments.disabled");

  return (
    <Alert variant="info">
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription className="leading-relaxed text-pretty">
        {t("desc")}
      </AlertDescription>
    </Alert>
  );
};

/** What happened to the purchase the buyer just came back from. */
const ReturnStatus = ({
  purchaseId,
  userId,
}: {
  purchaseId: string;
  userId: number;
}) => {
  const t = useTranslations("core.payments.return");
  const queryClient = useQueryClient();
  const onSettled = React.useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: exampleAccessRoot(userId),
    });
  }, [queryClient, userId]);
  const { check, error, isChecking, purchase, settled, slow } =
    usePurchaseReturn({ onSettled, purchaseId, userId });

  let variant: "destructive" | "info" | "success" | "warning" = "info";
  let message = t("checking");

  if (error) {
    variant = "warning";
    message = t("error");
  } else if (purchase) {
    switch (purchase.displayState) {
      case "awaiting_payment":
        message = t("checking");
        break;
      case "failed":
        variant = "destructive";
        message = t("failed");
        break;
      case "fulfillment_failed":
        variant = "warning";
        message = t("fulfillment_failed");
        break;
      case "fulfillment_pending":
      case "paid":
        variant = "success";
        message = t("paid");
        break;
      case "processing":
        message = t("processing");
        break;
      default:
        variant = "success";
        message = t("fulfilled");
    }
  }

  return (
    <Alert aria-live="polite" variant={variant}>
      <AlertDescription className="flex flex-col items-start gap-2 leading-relaxed">
        <span>{message}</span>
        {slow ? <span>{t("slow")}</span> : null}
        {!settled && (slow || error) ? (
          <Button
            isLoading={isChecking}
            onClick={() => void check()}
            size="sm"
            variant="outline"
          >
            <RefreshCwIcon aria-hidden="true" />
            {t("check_again")}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
};

/** The members-only content, fetched from a route that checks access itself. */
const FeatureCertificate = ({
  offerId,
  userId,
}: {
  offerId: ExampleOfferId;
  userId: number;
}) => {
  const t = useTranslations("@vitnode/example.payments.feature");
  const format = useFormatter();
  const { data, isError, isPending } = useQuery(
    exampleFeatureQueryOptions({ offerId, userId }),
  );

  if (isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-destructive text-sm">{t("error")}</p>;
  }

  return (
    <section
      aria-label={t("title")}
      className="bg-muted/50 flex flex-col gap-1 rounded-lg border p-4 text-sm leading-relaxed"
    >
      <p className="flex items-center gap-2 font-medium">
        <BadgeCheckIcon aria-hidden="true" className="text-success size-4" />
        {t("title")}
      </p>
      <p>{t("holder", { name: data.holder })}</p>
      <p className="text-muted-foreground">
        {t("serial", { serial: data.serial })}
      </p>
      {data.validUntil ? (
        <p className="text-muted-foreground">
          {t("valid_until", {
            date: format.dateTime(toDate(data.validUntil), {
              dateStyle: "long",
            }),
          })}
        </p>
      ) : null}
    </section>
  );
};

const OpenCheckoutNotice = ({
  onDone,
  purchaseId,
  userId,
}: {
  onDone: () => void;
  purchaseId: string;
  userId: number;
}) => {
  const t = useTranslations("core.payments.checkout");
  const tPage = useTranslations("@vitnode/example.payments");
  const cancel = useCancelPurchase({ userId });
  const [isContinuing, setIsContinuing] = React.useState(false);

  return (
    <Alert variant="warning">
      <AlertTitle>{tPage("open_checkout")}</AlertTitle>
      <AlertDescription className="flex flex-wrap gap-2">
        <Button
          isLoading={isContinuing}
          onClick={async () => {
            setIsContinuing(true);
            try {
              const { checkoutUrl } = await fetchPurchase(purchaseId, {
                refresh: true,
              });
              if (checkoutUrl) {
                window.location.assign(checkoutUrl);
              } else {
                onDone();
              }
            } finally {
              setIsContinuing(false);
            }
          }}
          size="sm"
        >
          {t("continue")}
        </Button>
        <Button
          isLoading={cancel.isPending}
          onClick={() => {
            cancel.mutate(purchaseId, {
              onError: error => {
                toast.error(t("error"), { description: error.message });
              },
              onSuccess: () => {
                toast.success(t("canceled"), {
                  description: t("canceled_desc"),
                });
                onDone();
              },
            });
          }}
          size="sm"
          variant="outline"
        >
          {t("cancel")}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

const useCheckoutAction = (userId: null | number) => {
  const t = useTranslations("core.payments.checkout");
  const checkout = useStartCheckout({ userId });
  const [openPurchase, setOpenPurchase] = React.useState<null | string>(null);

  const start = (
    offerId: ExampleOfferId,
    currency: string,
    interval: Interval | null,
  ) => {
    checkout.mutate(
      { currency, interval, offerId, pluginId: CONFIG_PLUGIN.pluginId },
      {
        onError: error => {
          if (
            isPaymentsRequestError(error) &&
            error.code === "checkout_in_progress" &&
            error.purchaseId
          ) {
            setOpenPurchase(error.purchaseId);

            return;
          }

          toast.error(t("error"), {
            description:
              isPaymentsRequestError(error) &&
              error.code === "checkout_uncertain"
                ? t("retry_hint")
                : error.message,
          });
        },
      },
    );
  };

  return { checkout, openPurchase, setOpenPurchase, start };
};

const PriceLine = ({
  amount,
  currency,
  interval,
}: {
  amount: number;
  currency: string;
  interval: Interval | null;
}) => {
  const t = useTranslations("core.payments");
  const formatMoney = useMoneyFormatter();
  const price = formatMoney({ amount, currency });

  return (
    <p className="text-2xl font-semibold tracking-tight tabular-nums">
      {interval ? t(`per_interval.${interval}`, { price }) : price}
    </p>
  );
};

const PaymentsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<PaymentsPageData, PaymentsSearch>) => {
  const t = useTranslations("@vitnode/example.payments");
  const tCheckout = useTranslations("core.payments.checkout");
  const tState = useTranslations("core.payments");
  const format = useFormatter();
  const { data: session } = useSessionQuery();
  const userId = session?.user?.id ?? loaderData.userId;
  const { data: settings } = useSuspenseQuery(paymentsSettingsQueryOptions());
  const { data: offerList } = useSuspenseQuery(
    paymentOffersQueryOptions({ pluginId: CONFIG_PLUGIN.pluginId }),
  );
  const { data: access } = useSuspenseQuery(
    exampleAccessQueryOptions({ userId }),
  );
  const [interval, setInterval] = React.useState<Interval>("month");
  const { checkout, openPurchase, setOpenPurchase, start } =
    useCheckoutAction(userId);
  const portal = useBillingPortal();

  const currencies = choosableCurrencies(settings, offerList.offers);
  const currency =
    search.currency && currencies.includes(search.currency)
      ? search.currency
      : ((settings.defaultCurrency &&
        currencies.includes(settings.defaultCurrency)
          ? settings.defaultCurrency
          : currencies[0]) ?? null);

  const lifetime = offerList.offers.find(
    offer => offer.id === EXAMPLE_OFFERS.lifetime,
  );
  const plan = offerList.offers.find(offer => offer.id === EXAMPLE_OFFERS.plan);
  const priceOf = (
    offer: PaymentOfferSummary | undefined,
    chosen: Interval | null,
  ) =>
    offer?.prices.find(
      price => price.currency === currency && price.interval === chosen,
    );

  const lifetimePrice = priceOf(lifetime, null);
  const planPrice = priceOf(plan, interval);
  const owned = access["lifetime-pass"].active;
  const subscribed = access["pro-plan"].active;
  const busy =
    checkout.isPending || (checkout.isSuccess && !!checkout.data.checkoutUrl);

  return (
    <div className="container mx-auto flex max-w-4xl flex-col gap-6 p-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {t("title")}
          </h1>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {t("desc")}
          </p>
        </div>

        {settings.enabled && currency ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{tCheckout("currency")}</span>
            <NativeSelect
              className="w-28"
              onChange={event => {
                void navigate({
                  resetScroll: false,
                  search: { ...search, currency: event.target.value },
                });
              }}
              value={currency}
            >
              {currencies.map(code => (
                <NativeSelectOption key={code} value={code}>
                  {code}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        ) : null}
      </header>

      {settings.enabled ? null : <DisabledNotice />}

      {search.purchase && userId !== null ? (
        <ReturnStatus purchaseId={search.purchase} userId={userId} />
      ) : null}

      {search.checkout === "canceled" && !search.purchase ? (
        <Alert variant="info">
          <AlertDescription>{t("canceled")}</AlertDescription>
        </Alert>
      ) : null}

      {settings.enabled && userId === null ? (
        <Alert variant="info">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {t("sign_in")}
            <Link
              className="font-medium underline underline-offset-4"
              to="/login"
            >
              {t("sign_in_link")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {openPurchase && userId !== null ? (
        <OpenCheckoutNotice
          onDone={() => {
            setOpenPurchase(null);
          }}
          purchaseId={openPurchase}
          userId={userId}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {t("lifetime.title")}
              {owned ? <Badge variant="success">{t("owned")}</Badge> : null}
            </CardTitle>
            <CardDescription className="leading-relaxed">
              {t("lifetime.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            {lifetimePrice ? (
              <PriceLine {...lifetimePrice} interval={null} />
            ) : settings.enabled ? (
              <p className="text-muted-foreground">
                {tCheckout("unavailable")}
              </p>
            ) : null}
            {owned && userId !== null ? (
              <FeatureCertificate
                offerId={EXAMPLE_OFFERS.lifetime}
                userId={userId}
              />
            ) : (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <LockIcon aria-hidden="true" className="size-4" />
                {t("locked")}
              </p>
            )}
          </CardContent>
          {owned || !settings.enabled ? null : (
            <CardFooter>
              <Button
                disabled={
                  !settings.enabled || !lifetimePrice || userId === null
                }
                isLoading={
                  busy &&
                  checkout.variables?.offerId === EXAMPLE_OFFERS.lifetime
                }
                onClick={() => {
                  if (currency) start(EXAMPLE_OFFERS.lifetime, currency, null);
                }}
              >
                <CreditCardIcon aria-hidden="true" />
                {busy && checkout.variables?.offerId === EXAMPLE_OFFERS.lifetime
                  ? tCheckout("redirecting")
                  : tCheckout("buy")}
              </Button>
            </CardFooter>
          )}
        </Card>

        <PlanCard
          busy={busy && checkout.variables?.offerId === EXAMPLE_OFFERS.plan}
          canBuy={settings.enabled && !!planPrice && userId !== null}
          enabled={settings.enabled}
          interval={interval}
          onIntervalChange={setInterval}
          onManage={() => {
            portal.mutate(
              {
                offerId: EXAMPLE_OFFERS.plan,
                pluginId: CONFIG_PLUGIN.pluginId,
              },
              {
                onError: error => {
                  toast.error(tState("billing.portal_error"), {
                    description: error.message,
                  });
                },
              },
            );
          }}
          onSubscribe={() => {
            if (currency) start(EXAMPLE_OFFERS.plan, currency, interval);
          }}
          plan={plan}
          planPrice={planPrice}
          portalPending={portal.isPending}
          subscribed={subscribed}
          userId={userId}
        />
      </div>

      {userId !== null && access["pro-plan"].accessUntil ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("access_until", {
            date: format.dateTime(toDate(access["pro-plan"].accessUntil), {
              dateStyle: "long",
            }),
          })}
        </p>
      ) : null}

      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("test_mode")}
      </p>
    </div>
  );
};

/** The buyer's live subscription to the example plan, if they have one. */
const usePlanSubscription = (userId: number): null | Subscription => {
  const { data } = useSuspenseInfiniteQuery(
    subscriptionsQueryOptions({ userId }),
  );

  return (
    data.pages
      .flatMap(page => page.edges)
      .find(
        subscription =>
          subscription.pluginId === CONFIG_PLUGIN.pluginId &&
          subscription.offerId === EXAMPLE_OFFERS.plan &&
          subscription.displayState !== "ended",
      ) ?? null
  );
};

const SubscriptionSummary = ({
  subscription,
}: {
  subscription: Subscription;
}) => {
  const t = useTranslations("core.payments");
  const format = useFormatter();
  const date = (value: Date | string) =>
    format.dateTime(toDate(value), { dateStyle: "long" });

  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      <div className="flex flex-wrap items-center gap-2">
        <SubscriptionStateBadge state={subscription.displayState} />
        <span className="text-muted-foreground">
          {t(`interval.${subscription.interval}`)}
        </span>
      </div>
      {subscription.paidThrough ? (
        <p>
          {t("billing.subscriptions.paid_through", {
            date: date(subscription.paidThrough),
          })}
        </p>
      ) : null}
      {subscription.currentPeriodEnd ? (
        <p className="text-muted-foreground">
          {t(
            subscription.cancelAtPeriodEnd
              ? "billing.subscriptions.ends"
              : "billing.subscriptions.renews",
            { date: date(subscription.currentPeriodEnd) },
          )}
        </p>
      ) : null}
      {subscription.displayState === "needs_attention" ? (
        <Alert variant="warning">
          <AlertDescription>
            {t("billing.subscriptions.attention")}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};

const PlanCard = ({
  busy,
  canBuy,
  enabled,
  interval,
  onIntervalChange,
  onManage,
  onSubscribe,
  plan,
  planPrice,
  portalPending,
  subscribed,
  userId,
}: {
  busy: boolean;
  canBuy: boolean;
  enabled: boolean;
  interval: Interval;
  onIntervalChange: (interval: Interval) => void;
  onManage: () => void;
  onSubscribe: () => void;
  plan: PaymentOfferSummary | undefined;
  planPrice: undefined | { amount: number; currency: string };
  portalPending: boolean;
  subscribed: boolean;
  userId: null | number;
}) => {
  const t = useTranslations("@vitnode/example.payments");
  const tCheckout = useTranslations("core.payments.checkout");
  const tState = useTranslations("core.payments");
  const intervals = (["month", "year"] as const).filter(item =>
    plan?.prices.some(price => price.interval === item),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {t("plan.title")}
          {subscribed ? (
            <Badge variant="success">{t("subscribed")}</Badge>
          ) : null}
        </CardTitle>
        <CardDescription className="leading-relaxed">
          {t("plan.desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {intervals.length > 1 ? (
          <ToggleGroup
            aria-label={tCheckout("interval")}
            className="bg-muted w-full rounded-lg p-0.5"
            onValueChange={next => {
              const picked = next[0];
              if (picked === "month" || picked === "year")
                onIntervalChange(picked);
            }}
            spacing={0.5}
            value={[interval]}
          >
            {intervals.map(item => (
              <ToggleGroupItem
                className="text-muted-foreground hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground flex-1 transition-[background-color,color,box-shadow] duration-150 hover:bg-transparent aria-pressed:shadow-sm"
                key={item}
                size="sm"
                value={item}
              >
                {tState(`interval.${item}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        {planPrice ? (
          <PriceLine {...planPrice} interval={interval} />
        ) : enabled ? (
          <p className="text-muted-foreground">{tCheckout("unavailable")}</p>
        ) : null}
        {userId === null ? null : (
          <React.Suspense fallback={<Skeleton className="h-16 w-full" />}>
            <PlanSubscriptionSlot userId={userId} />
          </React.Suspense>
        )}
        {subscribed && userId !== null ? (
          <FeatureCertificate offerId={EXAMPLE_OFFERS.plan} userId={userId} />
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <LockIcon aria-hidden="true" className="size-4" />
            {t("locked")}
          </p>
        )}
      </CardContent>
      {enabled ? (
        <CardFooter className="flex flex-wrap gap-2">
          {subscribed || userId === null ? null : (
            <Button disabled={!canBuy} isLoading={busy} onClick={onSubscribe}>
              <CreditCardIcon aria-hidden="true" />
              {busy ? tCheckout("redirecting") : tCheckout("subscribe")}
            </Button>
          )}
          {userId !== null && subscribed ? (
            <Button
              isLoading={portalPending}
              onClick={onManage}
              variant="outline"
            >
              <ExternalLinkIcon aria-hidden="true" />
              {tState("billing.manage")}
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
};

const PlanSubscriptionSlot = ({ userId }: { userId: number }) => {
  const subscription = usePlanSubscription(userId);

  return subscription ? (
    <SubscriptionSummary subscription={subscription} />
  ) : null;
};

export const route = defineRoute<PaymentsPageData, PaymentsSearch>({
  // `head` after `load`, always.
  load: async ({ context }) => {
    const auth = await ensureAuthState(context.queryClient);
    const userId = auth.user?.id ?? null;

    await Promise.all([
      context.queryClient.query({
        ...paymentsSettingsQueryOptions(),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...paymentOffersQueryOptions({ pluginId: CONFIG_PLUGIN.pluginId }),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...exampleAccessQueryOptions({ userId }),
        staleTime: "static",
      }),
      userId === null
        ? undefined
        : context.queryClient.infiniteQuery({
            ...subscriptionsQueryOptions({ userId }),
            staleTime: "static",
          }),
    ]);

    return { userId };
  },
  head: ({ t }) => ({
    description: t("@vitnode/example.payments.desc"),
    title: t("@vitnode/example.payments.title"),
  }),

  breadcrumb: false,
});

export default PaymentsPage;
