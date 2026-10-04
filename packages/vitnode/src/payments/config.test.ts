// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { PaymentsConfig } from "./config";
import type { PaymentOffer } from "./offer";
import type { PaymentProvider } from "./provider";

import {
  createPaymentsRegistry,
  publicPaymentsSettings,
  purchasablePrices,
  resolvePaymentsConfig,
} from "./config";
import { definePaymentOffer } from "./offer";

const SECRET = "sk_test_must_never_leave_the_server";

const provider = (
  overrides: Partial<PaymentProvider> = {},
): PaymentProvider & { secretKey: string } => ({
  checkout: {
    create: async () => await Promise.reject(new Error("unused")),
    expire: async () => await Promise.reject(new Error("unused")),
    retrieve: async () => await Promise.reject(new Error("unused")),
  },
  currencies: ["PLN", "USD", "EUR"],
  customers: {
    create: async () => await Promise.resolve({ customerId: "cus_1" }),
  },
  id: "stripe",
  name: "Stripe",
  payments: { retrieve: async () => await Promise.reject(new Error("unused")) },
  scope: "test",
  // A field an adapter might keep around - it must never be projected.
  secretKey: SECRET,
  webhooks: { verify: async () => await Promise.reject(new Error("unused")) },
  ...overrides,
});

const config = (overrides: Partial<PaymentsConfig> = {}): PaymentsConfig => ({
  currencies: { PLN: { currencyDisplay: "code" }, USD: {} },
  defaultCurrency: "PLN",
  providers: [provider()],
  ...overrides,
});

const lifetime = definePaymentOffer({
  id: "lifetime",
  mode: "one_time",
  name: "Lifetime",
  onPaid: async () => {},
  prices: { EUR: 450, PLN: 1900, USD: 500 },
  returnPath: "/example/payments",
});

describe("resolvePaymentsConfig", () => {
  it("is disabled when payments is not configured", () => {
    expect(resolvePaymentsConfig(undefined)).toBeNull();
  });

  it("fills operational defaults", () => {
    const resolved = resolvePaymentsConfig(config());

    expect(resolved?.defaultProvider.id).toBe("stripe");
    expect(resolved?.checkoutExpiresInMinutes).toBe(60);
    expect(resolved?.currencies).toEqual([
      { code: "PLN", currencyDisplay: "code" },
      { code: "USD", currencyDisplay: "symbol" },
    ]);
  });

  it("refuses a default currency that is not enabled", () => {
    expect(() =>
      resolvePaymentsConfig(config({ defaultCurrency: "EUR" })),
    ).toThrow(/defaultCurrency "EUR" is not one of the enabled currencies/);
  });

  it("refuses an unknown currency code", () => {
    expect(() =>
      resolvePaymentsConfig(
        config({ currencies: { PLN: {}, usd: {} }, defaultCurrency: "PLN" }),
      ),
    ).toThrow(/ISO 4217/);
  });

  it("refuses duplicate provider ids", () => {
    expect(() =>
      resolvePaymentsConfig(
        config({ defaultProvider: "stripe", providers: [provider(), provider()] }),
      ),
    ).toThrow(/registered twice/);
  });

  it("refuses a default provider that is not registered", () => {
    expect(() =>
      resolvePaymentsConfig(config({ defaultProvider: "paypal" })),
    ).toThrow(/"paypal" is not registered/);
  });

  it("requires a default provider once there is a choice", () => {
    expect(() =>
      resolvePaymentsConfig(
        config({ providers: [provider(), provider({ id: "stripe-eu" })] }),
      ),
    ).toThrow(/defaultProvider" is required/);
  });

  it("refuses an out-of-range checkout lifetime", () => {
    expect(() =>
      resolvePaymentsConfig(config({ checkoutExpiresInMinutes: 5 })),
    ).toThrow(/between 30 and 1440/);
  });

  it("refuses an empty provider list", () => {
    expect(() => resolvePaymentsConfig(config({ providers: [] }))).toThrow(
      /at least one provider/,
    );
  });
});

describe("publicPaymentsSettings", () => {
  it("projects only what the browser needs", () => {
    const settings = publicPaymentsSettings(resolvePaymentsConfig(config()));

    expect(settings).toEqual({
      currencies: [
        { code: "PLN", currencyDisplay: "code" },
        { code: "USD", currencyDisplay: "symbol" },
      ],
      defaultCurrency: "PLN",
      defaultProvider: "stripe",
      enabled: true,
      providers: [
        {
          capabilities: {
            currencies: ["PLN", "USD", "EUR"],
            customerPortal: false,
            intervals: [],
            oneTimePayments: true,
            subscriptions: false,
          },
          id: "stripe",
          name: "Stripe",
        },
      ],
    });
    expect(JSON.stringify(settings)).not.toContain(SECRET);
  });

  it("says disabled, with nothing else, when payments is off", () => {
    expect(publicPaymentsSettings(null)).toEqual({
      currencies: [],
      defaultCurrency: null,
      defaultProvider: null,
      enabled: false,
      providers: [],
    });
  });
});

describe("purchasablePrices", () => {
  it("offers only enabled currencies the provider can charge", () => {
    const resolved = resolvePaymentsConfig(
      config({
        currencies: { PLN: {}, USD: {} },
        providers: [provider({ currencies: ["PLN"] })],
      }),
    );

    // EUR is priced but not enabled; USD is enabled but the provider refuses it.
    expect(
      purchasablePrices(resolved!, resolved!.defaultProvider, lifetime),
    ).toEqual([{ amount: 1900, currency: "PLN", interval: null }]);
  });

  it("applies the provider's own amount limits", () => {
    const resolved = resolvePaymentsConfig(
      config({
        providers: [
          provider({
            checkAmount: money =>
              money.amount < 1000 ? "Below the provider minimum." : null,
          }),
        ],
      }),
    );

    expect(
      purchasablePrices(resolved!, resolved!.defaultProvider, lifetime).map(
        price => price.currency,
      ),
    ).toEqual(["PLN"]);
  });

  it("offers no subscription prices through a provider that cannot bill them", () => {
    const resolved = resolvePaymentsConfig(config());
    const plan = definePaymentOffer({
      id: "plan",
      intervals: { month: { PLN: 1900 } },
      mode: "subscription",
      name: "Plan",
      onSubscriptionChanged: async () => {},
      returnPath: "/example/payments",
    });

    expect(purchasablePrices(resolved!, resolved!.defaultProvider, plan)).toEqual(
      [],
    );
  });
});

describe("createPaymentsRegistry", () => {
  it("refuses two offers with one identity across modules", () => {
    expect(() =>
      createPaymentsRegistry({
        config: undefined,
        offers: [
          { offer: lifetime, pluginId: "@acme/shop" },
          { offer: lifetime, pluginId: "@acme/shop" },
        ],
      }),
    ).toThrow(/"@acme\/shop:lifetime" is registered twice/);
  });

  it("allows the same offer id in two plugins", () => {
    const registry = createPaymentsRegistry({
      config: undefined,
      offers: [
        { offer: lifetime, pluginId: "@acme/a" },
        { offer: lifetime, pluginId: "@acme/b" },
      ],
    });

    expect([...registry.offers.keys()]).toEqual([
      "@acme/a:lifetime",
      "@acme/b:lifetime",
    ]);
    expect(registry.config).toBeNull();
  });

  it.each<[string, Partial<PaymentOffer> | Record<string, unknown>, RegExp]>([
    ["an invalid mode", { mode: "lifetime" }, /mode must be/],
    ["missing prices", { prices: {} }, /declares no prices/],
    ["a zero price", { prices: { PLN: 0 } }, /greater than zero/],
    ["a decimal price", { prices: { PLN: 19.99 } }, /whole number/],
    ["an unknown currency", { prices: { ZZZ: 100 } }, /ISO 4217/],
    ["no fulfillment handler", { onPaid: undefined }, /"onPaid" handler/],
    ["an external return URL", { returnPath: "https://evil.example" }, /returnPath/],
    ["a protocol-relative return URL", { returnPath: "//evil.example" }, /returnPath/],
    ["an invalid id", { id: "Lifetime Offer" }, /lowercase/],
  ])("refuses an offer with %s", (_, override, error) => {
    expect(() =>
      createPaymentsRegistry({
        config: undefined,
        offers: [
          {
            offer: { ...lifetime, ...override } as PaymentOffer,
            pluginId: "@acme/shop",
          },
        ],
      }),
    ).toThrow(error);
  });

  it("refuses an unsupported recurring interval", () => {
    expect(() =>
      createPaymentsRegistry({
        config: undefined,
        offers: [
          {
            offer: {
              id: "plan",
              intervals: { week: { PLN: 100 } },
              mode: "subscription",
              name: "Plan",
              onSubscriptionChanged: async () => {},
              returnPath: "/plan",
            } as unknown as PaymentOffer,
            pluginId: "@acme/shop",
          },
        ],
      }),
    ).toThrow(/interval "week" is not supported/);
  });
});
