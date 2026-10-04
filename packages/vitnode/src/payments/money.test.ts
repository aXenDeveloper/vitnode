// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  assertCurrencyCode,
  assertMinorUnits,
  currencyExponent,
  formatMoney,
  isCurrencyCode,
  toDecimalString,
} from "./money";

// Intl separates an amount from a code with a no-break space in these locales.
const nbsp = (value: string) => value.replace(/ /g, " ");

describe("formatMoney", () => {
  it("formats PLN for pl-PL with the code", () => {
    expect(
      formatMoney(
        { amount: 1900, currency: "PLN" },
        { currencyDisplay: "code", locale: "pl-PL" },
      ),
    ).toBe(nbsp("19,00 PLN"));
  });

  it("formats USD for en-US with the symbol", () => {
    expect(
      formatMoney(
        { amount: 1900, currency: "USD" },
        { currencyDisplay: "symbol", locale: "en-US" },
      ),
    ).toBe("$19.00");
  });

  it("formats a zero-decimal currency without inventing cents", () => {
    expect(
      formatMoney({ amount: 1900, currency: "JPY" }, { locale: "en-US" }),
    ).toBe("¥1,900");
  });

  it("lets the locale place the symbol and pick separators", () => {
    expect(
      formatMoney(
        { amount: 123456, currency: "EUR" },
        { currencyDisplay: "symbol", locale: "de-DE" },
      ),
    ).toBe(nbsp("1.234,56 €"));
  });

  it("keeps the billing currency when only the UI locale changes", () => {
    const money = { amount: 1900, currency: "PLN" };

    expect(formatMoney(money, { currencyDisplay: "code", locale: "en-US" })).toBe(
      nbsp("PLN 19.00"),
    );
  });

  it("formats three-decimal currencies with three places", () => {
    expect(
      formatMoney(
        { amount: 1500, currency: "KWD" },
        { currencyDisplay: "code", locale: "en-US" },
      ),
    ).toBe(nbsp("KWD 1.500"));
  });

  it("formats amounts too large for a float without rounding them", () => {
    expect(
      formatMoney(
        { amount: 9007199254740991, currency: "USD" },
        { locale: "en-US" },
      ),
    ).toBe("$90,071,992,547,409.91");
  });
});

describe("toDecimalString", () => {
  it.each([
    [1900, "PLN", "19.00"],
    [5, "USD", "0.05"],
    [0, "USD", "0.00"],
    [1900, "JPY", "1900"],
    [1, "KWD", "0.001"],
  ])("%i %s is %s", (amount, currency, expected) => {
    expect(toDecimalString({ amount, currency })).toBe(expected);
  });
});

describe("currencies", () => {
  it("knows each currency's minor unit", () => {
    expect(currencyExponent("PLN")).toBe(2);
    expect(currencyExponent("JPY")).toBe(0);
    expect(currencyExponent("BHD")).toBe(3);
  });

  it.each(["usd", "US", "ABC", "XAU", "XTS", 840, null])(
    "refuses %s as a currency code",
    code => {
      expect(isCurrencyCode(code)).toBe(false);
      expect(() => assertCurrencyCode(code)).toThrow(/ISO 4217/);
    },
  );
});

describe("assertMinorUnits", () => {
  it("accepts whole amounts", () => {
    expect(assertMinorUnits(1900)).toBe(1900);
    expect(assertMinorUnits(0)).toBe(0);
  });

  it("refuses decimals - money is never a float", () => {
    expect(() => assertMinorUnits(19.99)).toThrow(/whole number/);
  });

  it("refuses negative amounts", () => {
    expect(() => assertMinorUnits(-1)).toThrow(/zero or more/);
  });

  it("refuses zero where a price is required", () => {
    expect(() => assertMinorUnits(0, { positive: true })).toThrow(
      /greater than zero/,
    );
  });

  it("refuses amounts JSON cannot carry exactly", () => {
    expect(() => assertMinorUnits(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      /whole number/,
    );
    expect(() => assertMinorUnits(Number.NaN)).toThrow();
    expect(() => assertMinorUnits("1900")).toThrow();
  });
});
