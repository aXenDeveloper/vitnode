/**
 * Money in VitNode is an integer count of a currency's minor units plus a
 * validated ISO 4217 code. Nothing in the payments pipeline does arithmetic on
 * decimals: an amount is converted to a decimal string only to be displayed.
 */
export interface Money {
  /** Whole minor units - `1900` is 19.00 PLN, `1900` is ¥1,900. */
  amount: number;
  currency: string;
}

/** How a currency is named next to an amount - `Intl.NumberFormat`'s option. */
export const CURRENCY_DISPLAYS = ["code", "symbol", "narrowSymbol", "name"] as const;
export type CurrencyDisplay = (typeof CURRENCY_DISPLAYS)[number];

/**
 * The largest amount VitNode stores or serialises. Amounts travel as JSON
 * numbers, so anything above this would silently lose precision on the way.
 */
export const MAX_MONEY_AMOUNT = Number.MAX_SAFE_INTEGER;

/**
 * ISO 4217 minor-unit exponents that are not 2. Every other active code uses
 * two decimal places. This is the currency's own definition and the only one
 * VitNode displays with - a payment provider that counts a currency differently
 * converts in its adapter.
 */
const ISO_EXPONENTS: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYW: 4,
};

/** Codes that exist in ISO 4217 but are not money anyone can be charged in. */
const NON_TENDER = new Set([
  "XAG",
  "XAU",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "XDR",
  "XPD",
  "XPT",
  "XSU",
  "XTS",
  "XUA",
  "XXX",
]);

let knownCurrencies: ReadonlySet<string> | undefined;

const supportedByRuntime = (): ReadonlySet<string> => {
  if (!knownCurrencies) {
    knownCurrencies = new Set(Intl.supportedValuesOf("currency"));
  }

  return knownCurrencies;
};

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Whether `code` is an uppercase ISO 4217 code for a real, chargeable currency. */
export const isCurrencyCode = (code: unknown): code is string =>
  typeof code === "string" &&
  /^[A-Z]{3}$/.test(code) &&
  !NON_TENDER.has(code) &&
  supportedByRuntime().has(code);

export const assertCurrencyCode = (code: unknown): string => {
  if (!isCurrencyCode(code)) {
    throw new MoneyError(
      `"${String(code)}" is not a supported ISO 4217 currency code. Use three uppercase letters, for example "USD" or "PLN".`,
    );
  }

  return code;
};

/** How many decimal places the currency's minor unit has (`2` for PLN, `0` for JPY). */
export const currencyExponent = (currency: string): number =>
  ISO_EXPONENTS[assertCurrencyCode(currency)] ?? 2;

/**
 * Refuses anything that is not a whole, safe, in-range number of minor units.
 * `positive` is for prices: a purchase of nothing is not routed through a
 * payment provider.
 */
export const assertMinorUnits = (
  amount: unknown,
  { positive = false }: { positive?: boolean } = {},
): number => {
  if (typeof amount !== "number" || !Number.isSafeInteger(amount)) {
    throw new MoneyError(
      `Amount ${String(amount)} must be a whole number of minor units (for example 1900 for 19.00), not a decimal.`,
    );
  }

  if (amount < 0 || (positive && amount === 0)) {
    throw new MoneyError(
      `Amount ${amount} must be ${positive ? "greater than zero" : "zero or more"}.`,
    );
  }

  if (amount > MAX_MONEY_AMOUNT) {
    throw new MoneyError(`Amount ${amount} is too large to store safely.`);
  }

  return amount;
};

export const assertMoney = (
  money: { amount: unknown; currency: unknown },
  options?: { positive?: boolean },
): Money => ({
  amount: assertMinorUnits(money.amount, options),
  currency: assertCurrencyCode(money.currency),
});

/**
 * The exact decimal string of an amount - `"19.00"` for 1900 PLN, `"1900"` for
 * 1900 JPY. Built from the integer digits, so no floating point is involved.
 */
export const toDecimalString = ({ amount, currency }: Money): string => {
  const exponent = currencyExponent(currency);
  const negative = amount < 0;
  const digits = String(Math.abs(amount)).padStart(exponent + 1, "0");
  const whole = digits.slice(0, digits.length - exponent);
  const fraction = digits.slice(digits.length - exponent);

  return `${negative ? "-" : ""}${whole}${exponent > 0 ? `.${fraction}` : ""}`;
};

const formatters = new Map<string, Intl.NumberFormat>();

const formatterFor = (
  locale: string,
  currency: string,
  currencyDisplay: CurrencyDisplay,
): Intl.NumberFormat => {
  const key = `${locale}|${currency}|${currencyDisplay}`;
  let formatter = formatters.get(key);

  if (!formatter) {
    const exponent = currencyExponent(currency);
    formatter = new Intl.NumberFormat(locale, {
      currency,
      currencyDisplay,
      maximumFractionDigits: exponent,
      minimumFractionDigits: exponent,
      style: "currency",
    });
    formatters.set(key, formatter);
  }

  return formatter;
};

/**
 * Formats an amount for people: the locale decides separators, spacing and
 * where the currency goes; `currencyDisplay` decides whether it is `PLN` or
 * `zł`. The UI locale and the billing currency are independent - switching
 * language never changes which currency is shown.
 *
 * ```ts
 * formatMoney({ amount: 1900, currency: "PLN" }, { locale: "pl-PL", currencyDisplay: "code" });
 * // "19,00 PLN"
 * ```
 */
export const formatMoney = (
  money: Money,
  {
    currencyDisplay = "symbol",
    locale,
  }: { currencyDisplay?: CurrencyDisplay; locale: string },
): string =>
  formatterFor(locale, money.currency, currencyDisplay).format(
    toDecimalString(money) as `${number}`,
  );
