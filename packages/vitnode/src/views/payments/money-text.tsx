import { useQuery } from "@tanstack/react-query";
import { useLocale } from "use-intl";

import type { CurrencyDisplay, Money } from "@/payments/money";

import { formatMoney } from "@/payments/money";

import { paymentsSettingsQueryOptions } from "./payments-query";

/** How this install shows `currency` - `"code"` or `"symbol"` - from the public settings. */
export const useCurrencyDisplay = (currency: string): CurrencyDisplay => {
  const { data } = useQuery(paymentsSettingsQueryOptions());

  return (
    data?.currencies.find(item => item.code === currency)?.currencyDisplay ??
    "symbol"
  );
};

/** `formatMoney` bound to the reader's locale and this install's display settings. */
export const useMoneyFormatter = () => {
  const locale = useLocale();
  const { data } = useQuery(paymentsSettingsQueryOptions());

  return (money: Money, currencyDisplay?: CurrencyDisplay): string =>
    formatMoney(money, {
      currencyDisplay:
        currencyDisplay ??
        data?.currencies.find(item => item.code === money.currency)
          ?.currencyDisplay ??
        "symbol",
      locale,
    });
};

/**
 * An amount in the reader's language and the record's own currency. The UI
 * locale only decides separators and placement - it never changes the currency.
 */
export const MoneyText = ({
  amount,
  className,
  currency,
  currencyDisplay,
}: Money & { className?: string; currencyDisplay?: CurrencyDisplay }) => {
  const locale = useLocale();
  const configured = useCurrencyDisplay(currency);

  return (
    <span className={className ?? "tabular-nums"}>
      {formatMoney(
        { amount, currency },
        { currencyDisplay: currencyDisplay ?? configured, locale },
      )}
    </span>
  );
};
