import { PaymentError } from "./errors";

const CURRENCY_PATTERN = /^[a-z]{3}$/;

/**
 * Lowercases an ISO 4217 code and refuses anything that is not three letters.
 *
 * @throws `PaymentError("invalid_currency")`.
 */
export const normalizePaymentCurrency = (currency: string): string => {
  const normalized = currency.trim().toLowerCase();
  if (!CURRENCY_PATTERN.test(normalized)) {
    throw new PaymentError(
      "invalid_currency",
      `"${currency}" is not a three-letter ISO 4217 currency code.`,
    );
  }

  return normalized;
};

/**
 * Refuses an amount that is not a positive safe integer. Amounts are always in
 * the currency's smallest unit as the provider counts it: cents for `usd`,
 * whole yen for `jpy`. Never pass a decimal or a float.
 *
 * @throws `PaymentError("invalid_amount")`.
 */
export const assertPaymentAmount = (amount: number): void => {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new PaymentError(
      "invalid_amount",
      `Payment amounts are positive integers in minor units; got ${String(amount)}.`,
    );
  }
};
