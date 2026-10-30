import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@vitnode/core/components/ui/alert";
import { Button } from "@vitnode/core/components/ui/button";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { definePluginRoute } from "@vitnode/core/routing";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { CreditCardIcon, RotateCwIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { manifest } from "@/manifest.gen";

import { CheckoutErrorAlert } from "./checkout-error";
import { formatMinorUnits, purchaseQueryOptions } from "./queries";
import { type CheckoutError, startCheckout } from "./start-checkout";

export const route = definePluginRoute({
  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("payments-demo.purchase.title"),
  }),
});

type StatusKey =
  | "expired"
  | "failed"
  | "none"
  | "paid"
  | "pending"
  | "processing";

const ALERT_VARIANT = {
  expired: "warning",
  failed: "destructive",
  none: "default",
  paid: "success",
  pending: "info",
  processing: "info",
} as const;

const PurchasePage = ({ params }: PluginRoutePageProps) => {
  const t = useTranslations("payments-demo");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const purchaseId = Number(params.purchaseId);
  const { data, isFetching, isPending } = useQuery(
    purchaseQueryOptions(purchaseId),
  );
  const [isStarting, setIsStarting] = React.useState(false);
  const [error, setError] = React.useState<CheckoutError | null>(null);

  if (isPending) {
    return (
      <div
        aria-busy="true"
        className="container mx-auto flex max-w-xl flex-col gap-4 px-4 py-8"
      >
        <span className="sr-only" role="status">
          {t("purchase.loading")}
        </span>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <CheckoutErrorAlert error="unknown" />
      </div>
    );
  }

  const paymentStatus = data.payment?.status;
  const status: StatusKey =
    data.paid || paymentStatus === "succeeded"
      ? "paid"
      : (paymentStatus ?? "none");
  const canRetry =
    !!data.payment && (status === "expired" || status === "failed");

  const onContinue = async () => {
    if (!data.payment) return;
    setIsStarting(true);
    setError(null);
    try {
      const result = await startCheckout({
        itemId: "sticker-pack",
        providerId: data.payment.providerId,
      });
      if ("redirectUrl" in result) {
        window.location.assign(result.redirectUrl);

        return;
      }
      setError(result.error);
      await queryClient.invalidateQueries({
        queryKey: [manifest.id, "purchases"],
      });
    } catch {
      setError("unknown");
    }
    setIsStarting(false);
  };

  return (
    <div
      aria-busy={isFetching}
      className="container mx-auto flex max-w-xl flex-col gap-6 px-4 py-8"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {t("items.sticker_pack.title")}
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          {formatMinorUnits(data.amount, data.currency, locale)}
        </p>
      </header>

      <Alert aria-live="polite" variant={ALERT_VARIANT[status]}>
        <AlertTitle>{t(`purchase.status.${status}.title`)}</AlertTitle>
        <AlertDescription className="leading-relaxed text-pretty">
          {t(`purchase.status.${status}.desc`)}
        </AlertDescription>
      </Alert>

      {error && <CheckoutErrorAlert error={error} />}

      <div className="flex flex-wrap items-center gap-3">
        {status === "pending" && (
          <Button isLoading={isStarting} onClick={onContinue}>
            <CreditCardIcon aria-hidden="true" />
            {t("purchase.continue")}
          </Button>
        )}
        {canRetry && (
          <Button isLoading={isStarting} onClick={onContinue}>
            <RotateCwIcon aria-hidden="true" />
            {t("purchase.try_again")}
          </Button>
        )}
        <HrefLink
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          href="/payments-demo"
        >
          {t("purchase.back")}
        </HrefLink>
      </div>
    </div>
  );
};

export default PurchasePage;
