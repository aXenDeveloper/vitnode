import type { CurrencyDisplay, Money } from "./money";
import type { PaymentOffer, RegisteredPaymentOffer } from "./offer";
import type { PaymentProvider, PaymentProviderCapabilities } from "./provider";
import type { BillingInterval } from "./status";

import { assertCurrencyCode, CURRENCY_DISPLAYS } from "./money";
import {
  offerPricesFor,
  paymentOfferKey,
  validatePaymentOffers,
} from "./offer";
import { PaymentsConfigError, providerCapabilities } from "./provider";

export interface PaymentsCurrencyConfig {
  /** `"code"` shows `19,00 PLN`, `"symbol"` shows `$19.00`. Default `"symbol"`. */
  currencyDisplay?: CurrencyDisplay;
}

/** `payments` in `buildApiConfig`. Leave it out and Payments is off. */
export interface PaymentsConfig {
  /** How long a hosted checkout stays payable, 30-1440 minutes. Default 60. */
  checkoutExpiresInMinutes?: number;
  /** Every currency new purchases may use. Removing one keeps its history. */
  currencies: Record<string, PaymentsCurrencyConfig>;
  /** Preselected in the UI. Must be one of `currencies`. */
  defaultCurrency: string;
  /** Required when more than one provider is registered. */
  defaultProvider?: string;
  providers: PaymentProvider[];
  /**
   * Days a processed webhook stays in the inbox before its row is deleted.
   * Failed ones are kept until resolved. Default 30.
   */
  webhookRetentionDays?: number;
}

export interface ResolvedPaymentsCurrency {
  code: string;
  currencyDisplay: CurrencyDisplay;
}

export interface ResolvedPaymentsConfig {
  checkoutExpiresInMinutes: number;
  currencies: ResolvedPaymentsCurrency[];
  defaultCurrency: string;
  defaultProvider: PaymentProvider;
  providers: PaymentProvider[];
  webhookRetentionDays: number;
}

const DEFAULT_CHECKOUT_EXPIRES_IN_MINUTES = 60;
const DEFAULT_WEBHOOK_RETENTION_DAYS = 30;
const PROVIDER_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

const wholeInRange = (
  value: number | undefined,
  fallback: number,
  [min, max]: [number, number],
  name: string,
): number => {
  if (value === undefined) return fallback;

  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new PaymentsConfigError(
      `"${name}" must be a whole number between ${min} and ${max}.`,
    );
  }

  return value;
};

/**
 * Validates `payments` once, at startup. Returns `null` when Payments is not
 * configured - every payment route then answers that Payments is disabled and
 * nothing else changes.
 */
export const resolvePaymentsConfig = (
  config: PaymentsConfig | undefined,
): null | ResolvedPaymentsConfig => {
  if (!config) return null;

  const currencyEntries = Object.entries(config.currencies ?? {});

  if (currencyEntries.length === 0) {
    throw new PaymentsConfigError(
      'Enable at least one currency in "payments.currencies", for example { USD: {} }.',
    );
  }

  const currencies = currencyEntries.map(([code, options]) => {
    try {
      assertCurrencyCode(code);
    } catch (error) {
      throw new PaymentsConfigError(
        `payments.currencies: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const currencyDisplay = options?.currencyDisplay ?? "symbol";

    if (!CURRENCY_DISPLAYS.includes(currencyDisplay)) {
      throw new PaymentsConfigError(
        `payments.currencies.${code}.currencyDisplay must be one of ${CURRENCY_DISPLAYS.join(", ")}.`,
      );
    }

    return { code, currencyDisplay };
  });

  if (!currencies.some(currency => currency.code === config.defaultCurrency)) {
    throw new PaymentsConfigError(
      `payments.defaultCurrency "${config.defaultCurrency}" is not one of the enabled currencies (${currencies.map(currency => currency.code).join(", ")}).`,
    );
  }

  const providers = config.providers ?? [];

  if (providers.length === 0) {
    throw new PaymentsConfigError(
      'Register at least one provider in "payments.providers", e.g. StripePaymentProvider().',
    );
  }

  const ids = new Set<string>();

  for (const provider of providers) {
    if (typeof provider?.id !== "string" || !PROVIDER_ID.test(provider.id)) {
      throw new PaymentsConfigError(
        `Provider id "${provider?.id ?? "(missing)"}" must be 1-32 lowercase letters, digits or dashes.`,
      );
    }

    if (ids.has(provider.id)) {
      throw new PaymentsConfigError(
        `Provider "${provider.id}" is registered twice in "payments.providers". Give the second one a different id.`,
      );
    }

    ids.add(provider.id);
  }

  if (providers.length > 1 && !config.defaultProvider) {
    throw new PaymentsConfigError(
      '"payments.defaultProvider" is required when more than one provider is registered.',
    );
  }

  const defaultProviderId = config.defaultProvider ?? providers[0].id;
  const defaultProvider = providers.find(
    provider => provider.id === defaultProviderId,
  );

  if (!defaultProvider) {
    throw new PaymentsConfigError(
      `payments.defaultProvider "${defaultProviderId}" is not registered. Registered: ${[...ids].join(", ")}.`,
    );
  }

  return {
    checkoutExpiresInMinutes: wholeInRange(
      config.checkoutExpiresInMinutes,
      DEFAULT_CHECKOUT_EXPIRES_IN_MINUTES,
      [30, 1440],
      "payments.checkoutExpiresInMinutes",
    ),
    currencies,
    defaultCurrency: config.defaultCurrency,
    defaultProvider,
    providers,
    webhookRetentionDays: wholeInRange(
      config.webhookRetentionDays,
      DEFAULT_WEBHOOK_RETENTION_DAYS,
      [1, 3650],
      "payments.webhookRetentionDays",
    ),
  };
};

/** The registry every request reads: config (or `null`) plus all offers. */
export interface PaymentsRegistry {
  config: null | ResolvedPaymentsConfig;
  offers: Map<string, RegisteredPaymentOffer>;
}

export const createPaymentsRegistry = ({
  config,
  offers,
}: {
  config: PaymentsConfig | undefined;
  offers: readonly RegisteredPaymentOffer[];
}): PaymentsRegistry => {
  const validated = validatePaymentOffers(offers);
  const resolved = resolvePaymentsConfig(config);

  return {
    config: resolved,
    offers: new Map(
      validated.map(entry => [
        paymentOfferKey(entry.pluginId, entry.offer.id),
        entry,
      ]),
    ),
  };
};

export const findPaymentProvider = (
  config: ResolvedPaymentsConfig,
  providerId: string | undefined,
): PaymentProvider | undefined =>
  providerId === undefined
    ? config.defaultProvider
    : config.providers.find(provider => provider.id === providerId);

/** Why `money` cannot be bought through `provider` now, or `null`. */
export const priceUnavailableReason = (
  config: ResolvedPaymentsConfig,
  provider: PaymentProvider,
  offer: PaymentOffer,
  money: Money,
): null | string => {
  if (offer.mode === "subscription" && !provider.subscriptions) {
    return `Provider "${provider.id}" cannot bill subscriptions.`;
  }

  if (!config.currencies.some(currency => currency.code === money.currency)) {
    return `${money.currency} is not enabled for new purchases.`;
  }

  if (!provider.currencies.includes(money.currency)) {
    return `Provider "${provider.id}" does not support ${money.currency}.`;
  }

  return provider.checkAmount?.(money) ?? null;
};

export interface PurchasablePrice extends Money {
  interval: BillingInterval | null;
}

/**
 * The prices a buyer may actually choose: the offer's explicit prices,
 * intersected with the enabled currencies and what the provider can charge.
 */
export const purchasablePrices = (
  config: ResolvedPaymentsConfig,
  provider: PaymentProvider,
  offer: PaymentOffer,
): PurchasablePrice[] => {
  const intervals: (BillingInterval | null)[] =
    offer.mode === "one_time"
      ? [null]
      : (Object.keys(offer.intervals) as BillingInterval[]);

  return intervals.flatMap(interval =>
    Object.entries(offerPricesFor(offer, interval) ?? {})
      .map(([currency, amount]) => ({ amount, currency, interval }))
      .filter(
        price =>
          priceUnavailableReason(config, provider, offer, price) === null,
      ),
  );
};

export interface PublicPaymentsSettings {
  currencies: ResolvedPaymentsCurrency[];
  defaultCurrency: null | string;
  defaultProvider: null | string;
  enabled: boolean;
  providers: {
    capabilities: PaymentProviderCapabilities;
    id: string;
    name: string;
  }[];
}

/**
 * Everything the browser may know about the configuration, and nothing more:
 * no keys, no secrets, no provider objects. The route validates it against its
 * schema on the way out.
 */
export const publicPaymentsSettings = (
  config: null | ResolvedPaymentsConfig,
): PublicPaymentsSettings =>
  config
    ? {
        currencies: config.currencies.map(({ code, currencyDisplay }) => ({
          code,
          currencyDisplay,
        })),
        defaultCurrency: config.defaultCurrency,
        defaultProvider: config.defaultProvider.id,
        enabled: true,
        providers: config.providers.map(provider => ({
          capabilities: providerCapabilities(provider),
          id: provider.id,
          name: provider.name,
        })),
      }
    : {
        currencies: [],
        defaultCurrency: null,
        defaultProvider: null,
        enabled: false,
        providers: [],
      };
