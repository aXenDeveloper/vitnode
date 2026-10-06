export interface PaymentsSearch {
  /** `canceled` when the buyer came back with the back button on the hosted page. */
  checkout?: "canceled";
  /** The billing currency the buyer picked. Independent of the UI language. */
  currency?: string;
  /** Set by the checkout return URL - the purchase to follow. */
  purchase?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalises rather than rejects: anything unexpected is simply dropped. */
export const paymentsSearch = (
  input: Record<string, unknown>,
): PaymentsSearch => ({
  ...(input.checkout === "canceled" ? { checkout: "canceled" as const } : {}),
  ...(typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency)
    ? { currency: input.currency }
    : {}),
  ...(typeof input.purchase === "string" && UUID.test(input.purchase)
    ? { purchase: input.purchase }
    : {}),
});
