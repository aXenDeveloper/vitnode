import { useQuery } from "@tanstack/react-query";
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
import { Label } from "@vitnode/core/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@vitnode/core/components/ui/radio-group";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { definePluginRoute } from "@vitnode/core/routing";
import { useSessionQuery } from "@vitnode/core/tanstack/auth";
import { HrefLink, useHrefNavigate } from "@vitnode/core/tanstack/link";
import { CheckIcon, CreditCardIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { CheckoutErrorAlert } from "./checkout-error";
import {
  catalogQueryOptions,
  formatMinorUnits,
  myPurchasesQueryOptions,
} from "./queries";
import { type CheckoutError, startCheckout } from "./start-checkout";

export const route = definePluginRoute({
  head: ({ t }) => ({
    description: t("payments-demo.shop.desc"),
    title: t("payments-demo.shop.title"),
  }),
});

const ShopPage = () => {
  const t = useTranslations("payments-demo");
  const locale = useLocale();
  const session = useSessionQuery();
  const navigate = useHrefNavigate();
  const signedIn = !!session.data?.user;
  const catalog = useQuery(catalogQueryOptions());
  const purchases = useQuery({
    ...myPurchasesQueryOptions(),
    enabled: signedIn,
  });
  const [providerId, setProviderId] = React.useState<null | string>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<CheckoutError | null>(null);

  const item = catalog.data?.items[0];
  const providers = catalog.data?.providers ?? [];
  const selectedProvider = providerId ?? providers[0]?.id ?? null;
  const purchase = purchases.data?.purchases.find(
    entry => entry.itemId === item?.id,
  );

  // A guest signs in first and comes back here to buy.
  const onSignInToBuy = async () => {
    await navigate("/login?returnTo=%2Fpayments-demo");
  };

  const onBuy = async () => {
    if (!item || !selectedProvider) return;
    setIsPending(true);
    setError(null);
    try {
      const result = await startCheckout({
        itemId: "sticker-pack",
        providerId: selectedProvider,
      });
      if ("redirectUrl" in result) {
        window.location.assign(result.redirectUrl);

        return;
      }
      setError(result.error);
    } catch {
      setError("unknown");
    }
    setIsPending(false);
  };

  return (
    <div className="container mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {t("shop.title")}
        </h1>
        <p className="text-muted-foreground leading-relaxed text-pretty">
          {t("shop.desc")}
        </p>
      </header>

      {catalog.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only" role="status">
            {t("shop.loading")}
          </span>
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : !item ? (
        <CheckoutErrorAlert error="unknown" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-balance">
              {t("items.sticker_pack.title")}
            </CardTitle>
            <CardDescription className="leading-relaxed text-pretty">
              {t("items.sticker_pack.desc")}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <p className="text-2xl font-semibold">
              {formatMinorUnits(item.amount, item.currency, locale)}
            </p>

            {providers.length === 0 && (
              <p className="text-muted-foreground leading-relaxed text-pretty">
                {t("shop.no_providers")}
              </p>
            )}

            {providers.length > 1 && !purchase?.paid && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">
                  {t("shop.provider")}
                </legend>
                <RadioGroup
                  onValueChange={value => {
                    setProviderId(String(value));
                  }}
                  value={selectedProvider}
                >
                  {providers.map(provider => (
                    <div className="flex items-center gap-2" key={provider.id}>
                      <RadioGroupItem
                        id={`provider-${provider.id}`}
                        value={provider.id}
                      />
                      <Label htmlFor={`provider-${provider.id}`}>
                        {provider.name}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </fieldset>
            )}

            {error && <CheckoutErrorAlert error={error} />}
          </CardContent>

          <CardFooter className="flex flex-wrap items-center gap-3">
            {purchase?.paid ? (
              <Badge variant="success">
                <CheckIcon aria-hidden="true" />
                {t("shop.owned")}
              </Badge>
            ) : (
              <Button
                disabled={!selectedProvider}
                isLoading={isPending}
                onClick={signedIn ? onBuy : onSignInToBuy}
              >
                <CreditCardIcon aria-hidden="true" />
                {t("shop.buy")}
              </Button>
            )}

            {purchase && (
              <HrefLink
                className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                href={`/payments-demo/purchases/${purchase.id}`}
              >
                {t("shop.view_purchase")}
              </HrefLink>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default ShopPage;
