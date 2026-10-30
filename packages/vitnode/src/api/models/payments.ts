import type { Context } from "hono";

import { and, asc, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { isUniqueViolation } from "@/api/lib/db-errors";
import {
  assertPaymentAmount,
  normalizePaymentCurrency,
} from "@/api/lib/payments/amount";
import { PaymentError, PaymentProviderError } from "@/api/lib/payments/errors";
import {
  type PaymentCheckoutState,
  type PaymentProviderApiPlugin,
} from "@/api/lib/payments/provider";
import {
  canTransitionPayment,
  isOpenPaymentStatus,
  OPEN_PAYMENT_STATUSES,
  type PaymentStatus,
} from "@/api/lib/payments/status";
import {
  core_payments,
  core_payments_webhook_events,
} from "@/database/payments";
import { CONFIG } from "@/lib/config";

export type { PaymentStatus };

type Db = EnvVitNode["Variables"]["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type PaymentRow = typeof core_payments.$inferSelect;

/** A payment as plugins see it. Never includes provider secrets. */
export interface Payment {
  amount: number;
  completedAt: Date | null;
  createdAt: Date;
  currency: string;
  description: string;
  /** Set on a `failed` or `expired` attempt that never reached the customer, e.g. `checkout_not_created`. */
  errorCode: null | string;
  expiresAt: Date;
  id: string;
  pluginId: string;
  providerId: string;
  reference: string;
  status: PaymentStatus;
  updatedAt: Date;
  userId: null | number;
}

/** What `createCheckout` returns: where to send the customer. */
export interface PaymentCheckout {
  /** When the hosted page stops accepting payments. */
  expiresAt: Date;
  paymentId: string;
  /** The provider's hosted page. Send the browser there; do not log it. */
  redirectUrl: string;
  /** `true` when an open checkout for the same reference was returned instead of a new one. */
  resumed: boolean;
}

export interface PaymentCreateCheckoutInput {
  /** Positive integer in minor units (cents for `usd`, yen for `jpy`). Decide it on the server. */
  amount: number;
  /** Same-site path the provider sends a customer who cancels, e.g. `/shop/orders/42`. */
  cancelPath: string;
  /** ISO 4217 code, any case. */
  currency: string;
  /** One line shown on the hosted page. At most 255 characters. */
  description: string;
  /** A configured provider instance id. */
  providerId: string;
  /**
   * The plugin's own opaque id for what is being paid for, e.g. `order:42`. At
   * most one payment per reference is open at a time; a retry after it expired
   * creates a new attempt with the same reference.
   */
  reference: string;
  /** Same-site path the provider sends the customer after paying. Show a pending state there - it is not proof of payment. */
  successPath: string;
  /** The signed-in user who pays and owns the payment. */
  userId: number;
}

/** What `handleWebhook` did with a verified event. */
export type PaymentWebhookOutcome =
  | "duplicate"
  | "ignored"
  | "mismatch"
  | "processed"
  | "unmatched";

const MIN_REPLAY_REMAINING_MS = 35 * 60 * 1000;
const MIN_RESUME_REMAINING_MS = 5 * 60 * 1000;
const ORPHAN_ATTEMPT_MS = 15 * 60 * 1000;
const REFRESH_INTERVAL_MS = 15 * 1000;
const RECONCILE_AFTER_MS = 10 * 60 * 1000;
const WEBHOOK_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const PAYMENT_DEFAULT_CHECKOUT_MINUTES = 60;
/** Stripe accepts 30 minutes to 24 hours; staying under 23 hours keeps the whole attempt inside its 24-hour idempotency window. */
export const PAYMENT_CHECKOUT_MINUTES_RANGE = {
  min: 30,
  max: 23 * 60,
} as const;

const PAYMENT_EVENT_NAMES = {
  expired: "payment.expired",
  failed: "payment.failed",
  processing: "payment.processing",
  succeeded: "payment.succeeded",
} as const satisfies Record<Exclude<PaymentStatus, "pending">, string>;

const toPayment = (row: PaymentRow): Payment => ({
  amount: row.amount,
  completedAt: row.completedAt,
  createdAt: row.createdAt,
  currency: row.currency,
  description: row.description,
  errorCode: row.errorCode,
  expiresAt: row.expiresAt,
  id: row.id,
  pluginId: row.pluginId,
  providerId: row.providerId,
  reference: row.reference,
  status: row.status,
  updatedAt: row.updatedAt,
  userId: row.userId,
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Turns a plugin's same-site path into an absolute URL on `VITNODE_WEB_URL`.
 * Refuses anything that could leave the site: a scheme, `//host`, backslashes.
 */
export const resolvePaymentReturnUrl = (path: string): string => {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    // oxlint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    throw new PaymentError(
      "invalid_return_path",
      `Payment return paths are same-site paths starting with a single "/"; got "${path}".`,
    );
  }

  const web = CONFIG.web;
  const url = new URL(path.slice(1), web.href);
  if (url.origin !== web.origin) {
    throw new PaymentError("invalid_return_path");
  }

  return url.toString();
};

/** The idempotency key of an attempt: the same for every call that attempt makes. */
export const paymentIdempotencyKey = (paymentId: string): string =>
  `vitnode-payment-${paymentId}`;

const describeError = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

/**
 * Server-side payments, available as `c.get("payments")` in API handlers. It
 * creates hosted checkouts with a configured provider instance, records their
 * outcome from verified webhooks, and recovers missed ones.
 *
 * Calls from a plugin route are scoped to that plugin (`c.get("plugin")`): a
 * plugin creates and reads only its own payments. A payment never changes
 * provider instance after it is created.
 *
 * @example
 * ```ts
 * const checkout = await c.get("payments").createCheckout({
 *   providerId: "stripe-main",
 *   userId: user.id,
 *   reference: `order:${order.id}`,
 *   amount: 500, // $5.00, decided on the server
 *   currency: "usd",
 *   description: "Sticker pack",
 *   successPath: `/shop/orders/${order.id}`,
 *   cancelPath: `/shop/orders/${order.id}`,
 * });
 *
 * return c.json({ redirectUrl: checkout.redirectUrl }, 200);
 * ```
 */
export class PaymentsModel {
  constructor(c: Context) {
    this.c = c as Context<EnvVitNode>;
  }

  protected readonly c: Context<EnvVitNode>;

  private allProviders(): PaymentProviderApiPlugin[] {
    return this.c.get("core").payments.providers;
  }

  private async applyCheckoutState(
    row: PaymentRow,
    state: PaymentCheckoutState,
  ): Promise<PaymentRow> {
    const mismatch = this.checkoutMismatch(row, state);
    if (mismatch) {
      await this.c
        .get("log")
        .error(`[payments] Ignored provider state for ${row.id}: ${mismatch}.`);

      return row;
    }

    const { after, moved } = await this.db.transaction(async tx => {
      const [locked] = await tx
        .select()
        .from(core_payments)
        .where(eq(core_payments.id, row.id))
        .for("update");
      if (!locked) return { after: row, moved: null };

      const moved = await this.writeCheckoutState(tx, locked, state);
      const [after] = await tx
        .select()
        .from(core_payments)
        .where(eq(core_payments.id, row.id));

      return { after: after ?? locked, moved };
    });

    if (moved) await this.emitStatusChange(moved);

    return after;
  }

  private checkoutMismatch(
    payment: PaymentRow,
    state: PaymentCheckoutState,
  ): null | string {
    if (payment.checkoutId && payment.checkoutId !== state.checkoutId) {
      return "the checkout id differs from the stored one";
    }
    if (state.paymentId && state.paymentId !== payment.id) {
      return "the checkout metadata names another payment";
    }
    if (state.amount !== null && state.amount !== payment.amount) {
      return "the amount differs";
    }
    if (state.currency !== null && state.currency !== payment.currency) {
      return "the currency differs";
    }
    if (
      payment.livemode !== null &&
      typeof state.livemode === "boolean" &&
      payment.livemode !== state.livemode
    ) {
      return "live and test mode differ";
    }

    return null;
  }

  private async claimRefresh(
    paymentId: string,
  ): Promise<PaymentRow | undefined> {
    const [claimed] = await this.db
      .update(core_payments)
      .set({ syncedAt: new Date() })
      .where(
        and(
          eq(core_payments.id, paymentId),
          or(
            isNull(core_payments.syncedAt),
            lt(
              core_payments.syncedAt,
              new Date(Date.now() - REFRESH_INTERVAL_MS),
            ),
          ),
        ),
      )
      .returning();

    return claimed;
  }

  private async emitStatusChange(payment: PaymentRow) {
    if (payment.status === "pending") return;

    await this.c.get("events").emit(
      PAYMENT_EVENT_NAMES[payment.status],
      {
        amount: payment.amount,
        currency: payment.currency,
        paymentId: payment.id,
        pluginId: payment.pluginId,
        providerId: payment.providerId,
        reference: payment.reference,
        userId: payment.userId,
      },
      { pluginId: "@vitnode/core" },
    );
  }

  private async expireUnstarted(row: PaymentRow, errorCode: string) {
    const [expired] = await this.db
      .update(core_payments)
      .set({ status: "expired", errorCode })
      .where(
        and(
          eq(core_payments.id, row.id),
          eq(core_payments.status, "pending"),
          isNull(core_payments.checkoutId),
        ),
      )
      .returning();

    if (expired) await this.emitStatusChange(expired);
  }

  private async lockPaymentForCheckout(
    tx: Tx,
    providerId: string,
    checkout: PaymentCheckoutState,
  ): Promise<PaymentRow | undefined> {
    const [byCheckout] = await tx
      .select()
      .from(core_payments)
      .where(
        and(
          eq(core_payments.providerId, providerId),
          eq(core_payments.checkoutId, checkout.checkoutId),
        ),
      )
      .for("update");
    if (byCheckout) return byCheckout;

    if (!checkout.paymentId || !UUID_PATTERN.test(checkout.paymentId)) {
      return undefined;
    }

    const [byPaymentId] = await tx
      .select()
      .from(core_payments)
      .where(
        and(
          eq(core_payments.id, checkout.paymentId),
          eq(core_payments.providerId, providerId),
        ),
      )
      .for("update");

    return byPaymentId;
  }

  private async logProviderError(
    provider: PaymentProviderApiPlugin,
    operation: string,
    error: unknown,
  ) {
    const level =
      error instanceof PaymentProviderError && error.kind === "rejected"
        ? "warn"
        : "error";

    await this.c
      .get("log")
      [level](
        `[payments] ${operation} on provider "${provider.id}" failed: ${describeError(error)}`,
      );
  }

  private provider(providerId: string): PaymentProviderApiPlugin {
    const provider = this.allProviders().find(item => item.id === providerId);
    if (!provider) {
      throw new PaymentError(
        "provider_not_found",
        this.allProviders().length === 0
          ? "No payment providers are configured. Add one to `payments.providers` in the API config."
          : `No payment provider with id "${providerId}" is configured.`,
      );
    }

    return provider;
  }

  private async resumeOrClose(
    open: PaymentRow,
    input: PaymentCreateCheckoutInput,
  ): Promise<null | PaymentCheckout> {
    if (open.userId !== input.userId) {
      throw new PaymentError("reference_in_use");
    }
    if (open.status === "processing") {
      throw new PaymentError("payment_processing");
    }

    const remaining = open.expiresAt.getTime() - Date.now();
    const compatible =
      open.providerId === input.providerId &&
      open.amount === input.amount &&
      open.currency === input.currency &&
      open.description === input.description;

    if (
      compatible &&
      open.checkoutId &&
      open.checkoutUrl &&
      remaining > MIN_RESUME_REMAINING_MS
    ) {
      return {
        expiresAt: open.expiresAt,
        paymentId: open.id,
        redirectUrl: open.checkoutUrl,
        resumed: true,
      };
    }

    if (compatible && !open.checkoutId && remaining > MIN_REPLAY_REMAINING_MS) {
      return await this.startCheckout(open, this.provider(open.providerId), {
        cancelPath: input.cancelPath,
        successPath: input.successPath,
        resumed: true,
      });
    }

    if (!open.checkoutId) {
      await this.expireUnstarted(open, "checkout_not_created");

      return null;
    }

    const provider = this.provider(open.providerId);
    if (!provider.expireCheckout) {
      throw new PaymentError(
        "payment_in_progress",
        `Provider "${provider.id}" cannot close checkout early; wait until it expires.`,
      );
    }

    let state: PaymentCheckoutState;
    try {
      state = await provider.expireCheckout(open.checkoutId);
    } catch (error) {
      await this.logProviderError(provider, "expireCheckout", error);
      throw new PaymentError("provider_unavailable");
    }
    const after = await this.applyCheckoutState(open, state);
    if (after.status === "processing") {
      throw new PaymentError("payment_processing");
    }
    if (isOpenPaymentStatus(after.status)) {
      throw new PaymentError("payment_in_progress");
    }

    return null;
  }

  private async startCheckout(
    row: PaymentRow,
    provider: PaymentProviderApiPlugin,
    {
      cancelPath,
      resumed,
      successPath,
    }: { cancelPath: string; resumed: boolean; successPath: string },
  ): Promise<PaymentCheckout> {
    let created: PaymentCheckoutState & { url: string };
    try {
      created = await provider.createCheckout({
        amount: row.amount,
        cancelUrl: resolvePaymentReturnUrl(cancelPath),
        currency: row.currency,
        description: row.description,
        expiresAt: row.expiresAt,
        idempotencyKey: paymentIdempotencyKey(row.id),
        paymentId: row.id,
        successUrl: resolvePaymentReturnUrl(successPath),
      });
    } catch (error) {
      await this.logProviderError(provider, "createCheckout", error);

      if (error instanceof PaymentProviderError && error.kind === "rejected") {
        const [failed] = await this.db
          .update(core_payments)
          .set({ status: "failed", errorCode: error.code.slice(0, 64) })
          .where(
            and(
              eq(core_payments.id, row.id),
              eq(core_payments.status, "pending"),
              isNull(core_payments.checkoutId),
            ),
          )
          .returning();
        if (failed) await this.emitStatusChange(failed);

        throw new PaymentError("provider_rejected", error.message);
      }

      throw new PaymentError("provider_unavailable");
    }

    if (
      (created.amount !== null && created.amount !== row.amount) ||
      (created.currency !== null && created.currency !== row.currency)
    ) {
      await this.c
        .get("log")
        .error(
          `[payments] Provider "${provider.id}" created checkout ${created.checkoutId} for payment ${row.id} with a different amount or currency.`,
        );
      throw new PaymentError("provider_unavailable");
    }

    const after = await this.applyCheckoutState(row, created);
    if (after.status !== "pending" || after.checkoutId !== created.checkoutId) {
      throw new PaymentError(
        after.status === "processing"
          ? "payment_processing"
          : "payment_in_progress",
      );
    }

    return {
      expiresAt: after.expiresAt,
      paymentId: after.id,
      redirectUrl: created.url,
      resumed,
    };
  }

  private async syncFromProvider(row: PaymentRow): Promise<PaymentRow> {
    const provider = this.allProviders().find(
      item => item.id === row.providerId,
    );
    if (!provider?.retrieveCheckout || !row.checkoutId) return row;

    let state: PaymentCheckoutState;
    try {
      state = await provider.retrieveCheckout(row.checkoutId);
    } catch (error) {
      await this.logProviderError(provider, "retrieveCheckout", error);

      return row;
    }

    return await this.applyCheckoutState(row, state);
  }

  private async writeCheckoutState(
    tx: Tx,
    payment: PaymentRow,
    state: PaymentCheckoutState,
  ): Promise<null | PaymentRow> {
    const to = state.status;
    const moves =
      to !== payment.status && canTransitionPayment(payment.status, to);
    const stillOpen = isOpenPaymentStatus(moves ? to : payment.status);

    if (!moves && !isOpenPaymentStatus(payment.status)) {
      if (!payment.checkoutId) {
        await tx
          .update(core_payments)
          .set({ checkoutId: state.checkoutId })
          .where(
            and(
              eq(core_payments.id, payment.id),
              isNull(core_payments.checkoutId),
            ),
          );
      }

      return null;
    }

    const [updated] = await tx
      .update(core_payments)
      .set({
        checkoutId: payment.checkoutId ?? state.checkoutId,
        checkoutUrl: stillOpen ? (state.url ?? payment.checkoutUrl) : null,
        livemode: state.livemode ?? payment.livemode,
        providerStatus: state.providerStatus.slice(0, 50),
        syncedAt: new Date(),
        ...(moves
          ? {
              status: to,
              completedAt: to === "succeeded" ? new Date() : null,
            }
          : {}),
      })
      .where(
        and(
          eq(core_payments.id, payment.id),
          eq(core_payments.status, payment.status),
        ),
      )
      .returning();

    if (!moves) return null;

    return updated ?? null;
  }

  /**
   * Starts a hosted checkout, or returns the open one for the same reference
   * when it still matches. The local attempt is stored before the provider is
   * called, and the provider gets a per-attempt idempotency key, so a timeout
   * never leaves two checkouts for one attempt.
   *
   * Every argument comes from the server. Never pass an amount, currency, user
   * or path taken from the request body.
   *
   * @throws `PaymentError` - `provider_not_found`, `invalid_amount`,
   * `invalid_currency`, `invalid_return_path`, `reference_in_use`,
   * `payment_processing`, `payment_in_progress`, `provider_rejected` or
   * `provider_unavailable` (safe to retry).
   */
  async createCheckout(
    input: PaymentCreateCheckoutInput,
  ): Promise<PaymentCheckout> {
    const provider = this.provider(input.providerId);
    const currency = normalizePaymentCurrency(input.currency);
    assertPaymentAmount(input.amount);
    try {
      provider.validateAmount?.({ amount: input.amount, currency });
    } catch (error) {
      if (error instanceof PaymentProviderError) {
        throw new PaymentError("invalid_amount", error.message);
      }
      throw error;
    }
    const description = input.description.trim().slice(0, 255);
    const reference = input.reference.trim();
    if (!reference || reference.length > 255) {
      throw new Error("A payment reference is 1-255 characters.");
    }
    resolvePaymentReturnUrl(input.successPath);
    resolvePaymentReturnUrl(input.cancelPath);

    const [open] = await this.db
      .select()
      .from(core_payments)
      .where(
        and(
          eq(core_payments.pluginId, this.pluginId),
          eq(core_payments.reference, reference),
          inArray(core_payments.status, OPEN_PAYMENT_STATUSES),
        ),
      )
      .limit(1);

    if (open) {
      const resumed = await this.resumeOrClose(open, {
        ...input,
        currency,
        description,
      });
      if (resumed) return resumed;
    }

    const now = Date.now();
    const id = randomUUID();
    let row: PaymentRow | undefined;
    try {
      [row] = await this.db
        .insert(core_payments)
        .values({
          id,
          pluginId: this.pluginId,
          reference,
          userId: input.userId,
          providerId: provider.id,
          providerType: provider.type,
          amount: input.amount,
          currency,
          description,
          status: "pending",
          expiresAt: new Date(now + this.c.get("core").payments.checkoutTtlMs),
        })
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PaymentError("payment_in_progress");
      }
      throw error;
    }

    if (!row) throw new Error("Inserting the payment returned no row.");

    return await this.startCheckout(row, provider, {
      cancelPath: input.cancelPath,
      successPath: input.successPath,
      resumed: false,
    });
  }

  /**
   * Reads one of this plugin's payments for its owner. With `refresh`, an open
   * payment whose provider has not reported for a while is re-read from the
   * provider (at most once every 15 seconds per payment), so a customer who
   * returns from the hosted page sees a confirmed result even if the webhook is
   * late. The provider being down is not an error: the stored status is
   * returned.
   *
   * @throws `PaymentError("payment_not_found")` when the payment does not
   * exist, belongs to another plugin, or `userId` does not own it.
   */
  async getForUser({
    paymentId,
    refresh = false,
    userId,
  }: {
    paymentId: string;
    refresh?: boolean;
    userId: number;
  }): Promise<Payment> {
    if (!UUID_PATTERN.test(paymentId)) {
      throw new PaymentError("payment_not_found");
    }

    const [row] = await this.db
      .select()
      .from(core_payments)
      .where(
        and(
          eq(core_payments.id, paymentId),
          eq(core_payments.pluginId, this.pluginId),
          eq(core_payments.userId, userId),
        ),
      )
      .limit(1);
    if (!row) throw new PaymentError("payment_not_found");

    if (!refresh || !isOpenPaymentStatus(row.status) || !row.checkoutId) {
      return toPayment(row);
    }

    const claimed = await this.claimRefresh(row.id);
    if (!claimed) return toPayment(row);

    return toPayment(await this.syncFromProvider(claimed));
  }

  /**
   * Verifies and applies one provider webhook. The event id and the payment's
   * new status are committed in one transaction: a database failure throws, so
   * the route answers `500` and the provider redelivers. A redelivered event is
   * acknowledged without being applied again.
   *
   * Server-only; called by core's webhook route.
   *
   * @throws `PaymentError("provider_not_found")` for an unknown instance id, and
   * whatever the adapter's `verifyWebhook` throws.
   */
  async handleWebhook({
    body,
    headers,
    providerId,
  }: {
    body: Uint8Array;
    headers: Headers;
    providerId: string;
  }): Promise<{ outcome: PaymentWebhookOutcome; paymentId?: string }> {
    const provider = this.provider(providerId);
    const event = await provider.verifyWebhook({ body, headers });
    if (event.kind === "ignored") return { outcome: "ignored" };

    const { checkout } = event;
    const result = await this.db.transaction(async tx => {
      const [recorded] = await tx
        .insert(core_payments_webhook_events)
        .values({
          providerId,
          eventId: event.eventId.slice(0, 255),
          type: event.type.slice(0, 100),
        })
        .onConflictDoNothing()
        .returning();
      if (!recorded) return { outcome: "duplicate" as const };

      const payment = await this.lockPaymentForCheckout(
        tx,
        providerId,
        checkout,
      );
      if (!payment) return { outcome: "unmatched" as const };

      const mismatch = this.checkoutMismatch(payment, checkout);
      if (mismatch) {
        await this.c
          .get("log")
          .error(
            `[payments] Ignored ${event.type} ${event.eventId} for payment ${payment.id}: ${mismatch}.`,
          );

        return { outcome: "mismatch" as const, paymentId: payment.id };
      }

      await tx
        .update(core_payments_webhook_events)
        .set({ paymentId: payment.id })
        .where(
          and(
            eq(core_payments_webhook_events.providerId, providerId),
            eq(core_payments_webhook_events.eventId, recorded.eventId),
          ),
        );

      const moved = await this.writeCheckoutState(tx, payment, checkout);

      return {
        moved,
        outcome: "processed" as const,
        paymentId: payment.id,
      };
    });

    if ("moved" in result && result.moved) {
      await this.emitStatusChange(result.moved);
    }
    if (result.outcome === "unmatched") {
      await this.c
        .get("log")
        .warn(
          `[payments] ${event.type} ${event.eventId} on provider "${providerId}" matches no payment; acknowledged without changes.`,
        );
    }

    return { outcome: result.outcome, paymentId: result.paymentId };
  }

  /**
   * This plugin's payments for one reference, newest first. A plugin derives
   * what the customer has paid for from these: a reference is paid once one of
   * its payments is `succeeded`.
   */
  async listByReference(reference: string): Promise<Payment[]> {
    const rows = await this.db
      .select()
      .from(core_payments)
      .where(
        and(
          eq(core_payments.pluginId, this.pluginId),
          eq(core_payments.reference, reference),
        ),
      )
      .orderBy(desc(core_payments.createdAt));

    return rows.map(toPayment);
  }

  /** The configured provider instances, safe to show in a picker: `id`, `name` and `type`. */
  providers(): { id: string; name: string; type: string }[] {
    return this.allProviders().map(({ id, name, type }) => ({
      id,
      name,
      type,
    }));
  }

  /**
   * Recovers open payments nobody has heard about for a while: re-reads their
   * checkout from the provider, and expires attempts whose checkout was never
   * created. Run by core's `reconcile-payments` cron job; safe to run on
   * several instances at once. A provider that is down is skipped until the
   * next run.
   */
  async reconcile({ limit = 25 }: { limit?: number } = {}): Promise<{
    checked: number;
  }> {
    const now = Date.now();
    const rows = await this.db
      .select()
      .from(core_payments)
      .where(
        and(
          inArray(core_payments.status, OPEN_PAYMENT_STATUSES),
          lt(core_payments.updatedAt, new Date(now - RECONCILE_AFTER_MS)),
        ),
      )
      .orderBy(asc(core_payments.updatedAt))
      .limit(limit);

    for (const row of rows) {
      try {
        if (!row.checkoutId) {
          if (row.createdAt.getTime() < now - ORPHAN_ATTEMPT_MS) {
            await this.expireUnstarted(row, "checkout_not_created");
          }
          continue;
        }

        const claimed = await this.claimRefresh(row.id);
        if (claimed) await this.syncFromProvider(claimed);
      } catch (error) {
        await this.c
          .get("log")
          .error(
            `[payments] Reconciling payment ${row.id} failed: ${describeError(error)}`,
          );
      }
    }

    await this.db
      .delete(core_payments_webhook_events)
      .where(
        lt(
          core_payments_webhook_events.receivedAt,
          new Date(now - WEBHOOK_EVENT_RETENTION_MS),
        ),
      );

    return { checked: rows.length };
  }

  private get db(): Db {
    return this.c.get("db");
  }

  private get pluginId(): string {
    return this.c.get("plugin")?.id ?? "@vitnode/core";
  }
}
