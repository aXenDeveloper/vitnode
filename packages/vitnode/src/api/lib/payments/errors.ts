/** Why `c.get("payments")` refused a call. Each code maps to one HTTP status. */
export const PAYMENT_ERROR_STATUS = {
  /** No providers are configured, or the id names none of them. */
  provider_not_found: 400,
  invalid_amount: 400,
  invalid_currency: 400,
  /** `successPath`/`cancelPath` is not a same-site path. */
  invalid_return_path: 400,
  /** The payment does not exist, or belongs to another user or plugin. */
  payment_not_found: 404,
  /** Another user already has an open payment for this reference. */
  reference_in_use: 409,
  /** An open payment for this reference could not be closed to start a new one. */
  payment_in_progress: 409,
  /** The customer finished a checkout that the provider has not settled yet. */
  payment_processing: 409,
  /** The provider refused to create the checkout; the attempt is `failed`. */
  provider_rejected: 502,
  /** The provider could not be reached or is misconfigured. Safe to retry. */
  provider_unavailable: 503,
} as const;

export type PaymentErrorCode = keyof typeof PAYMENT_ERROR_STATUS;

/**
 * Thrown by `c.get("payments")`. Its `code` is stable and safe to return to a
 * browser; its message is for logs. `status` is the HTTP status to answer with.
 */
export class PaymentError extends Error {
  constructor(code: PaymentErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PaymentError";
    this.code = code;
    this.status = PAYMENT_ERROR_STATUS[code];
  }

  readonly code: PaymentErrorCode;
  readonly status: (typeof PAYMENT_ERROR_STATUS)[PaymentErrorCode];
}

/**
 * Thrown by a payment provider adapter. `kind` tells core what to do next:
 *
 * - `unavailable`: a network error, timeout, rate limit or provider outage. The
 *   request may or may not have reached the provider, so core keeps the attempt
 *   and retries it later with the same idempotency key.
 * - `rejected`: the provider refused the request for good (invalid parameters,
 *   unsupported currency). Core marks a new attempt `failed`.
 * - `configuration`: the adapter is missing a secret or holds a wrong one.
 *   Handled like `unavailable`, and logged.
 *
 * Never put secrets, card details or checkout URLs in the message.
 */
export class PaymentProviderError extends Error {
  constructor({
    code,
    kind,
    message,
  }: {
    /** A short, provider-neutral code stored on a failed attempt, e.g. `amount_too_small`. */
    code: string;
    kind: "configuration" | "rejected" | "unavailable";
    message: string;
  }) {
    super(message);
    this.name = "PaymentProviderError";
    this.code = code;
    this.kind = kind;
  }

  readonly code: string;
  readonly kind: "configuration" | "rejected" | "unavailable";
}

/**
 * Thrown by an adapter's `verifyWebhook` when the signature, its timestamp or
 * the payload does not check out. Core answers `400` and changes nothing.
 */
export class PaymentWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentWebhookVerificationError";
  }
}
