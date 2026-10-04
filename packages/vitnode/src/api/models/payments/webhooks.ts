import { and, eq, inArray, sql } from "drizzle-orm";

import type {
  PaymentProvider,
  ProviderWebhookEvent,
  ProviderWebhookTarget,
} from "@/payments/provider";

import { core_payments_webhook_events } from "@/database/payments";

import type { PaymentsContext } from "./shared";

import {
  describePaymentsError,
  isPermanentPaymentsError,
  PaymentsPermanentError,
  providerForRow,
} from "./shared";
import {
  applyCheckoutState,
  syncInvoice,
  syncPayment,
  syncSubscription,
} from "./sync";

export const PROCESS_EVENT_TASK = "payments-process-event";

export type WebhookAcceptance =
  | { eventId: number; queueId: number; status: "accepted" }
  | { status: "duplicate" };

/**
 * Stores a verified event and queues its processing in one transaction. Only
 * when this returns may the provider be told "received": if the insert or the
 * dispatch fails, the error propagates, the provider gets a 5xx and delivers
 * the event again.
 *
 * The provider's event id is unique per provider and environment, so a
 * repeated delivery finds the existing row and queues nothing.
 */
export const acceptWebhookEvent = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  event: ProviderWebhookEvent & { target: ProviderWebhookTarget },
): Promise<WebhookAcceptance> =>
  await c.get("db").transaction(async tx => {
    const [inserted] = await tx
      .insert(core_payments_webhook_events)
      .values({
        externalId: event.id,
        provider: provider.id,
        providerScope: event.scope,
        target: { ...event.target },
        type: event.type,
      })
      .onConflictDoNothing()
      .returning({ id: core_payments_webhook_events.id });

    if (!inserted) return { status: "duplicate" as const };

    const { id: queueId } = await c.get("queue").dispatch({
      maxAttempts: 8,
      name: PROCESS_EVENT_TASK,
      payload: { eventId: inserted.id },
      pluginId: "@vitnode/core",
      tx,
    });

    return { eventId: inserted.id, queueId, status: "accepted" as const };
  });

const processTarget = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  target: ProviderWebhookTarget,
): Promise<void> => {
  switch (target.kind) {
    case "checkout": {
      const checkout = await provider.checkout.retrieve(target.id);
      const applied = await applyCheckoutState(c, provider, checkout);

      if (applied.subscriptionId) {
        await syncSubscription(c, provider, applied.subscriptionId, {
          checkoutPurchase: applied.purchase,
        });
      }

      return;
    }
    case "invoice":
      await syncInvoice(c, provider, target.id, target.signal);

      return;
    case "payment":
      await syncPayment(c, provider, target.id);

      return;
    case "subscription":
      await syncSubscription(c, provider, target.id);
  }
};

const parseTarget = (raw: Record<string, string>): ProviderWebhookTarget => {
  switch (raw.kind) {
    case "checkout":
    case "payment":
    case "subscription":
      return { id: raw.id, kind: raw.kind };
    case "invoice":
      return {
        id: raw.id,
        kind: "invoice",
        signal:
          raw.signal === "paid" ||
          raw.signal === "payment_failed" ||
          raw.signal === "action_required"
            ? raw.signal
            : "updated",
      };
    default:
      throw new PaymentsPermanentError(`Unknown webhook target "${raw.kind}".`);
  }
};

/**
 * Processes one stored event: re-reads the object from the provider and
 * applies it. A retryable failure is recorded and rethrown so the queue tries
 * again with backoff; a permanent one is recorded and kept for the AdminCP.
 */
export const processWebhookEvent = async (
  c: PaymentsContext,
  eventId: number,
): Promise<void> => {
  const db = c.get("db");
  const [event] = await db
    .select()
    .from(core_payments_webhook_events)
    .where(eq(core_payments_webhook_events.id, eventId));

  if (!event || event.status === "processed") return;

  try {
    const provider = providerForRow(c, event);
    await processTarget(c, provider, parseTarget(event.target));

    await db
      .update(core_payments_webhook_events)
      .set({
        attempts: sql`${core_payments_webhook_events.attempts} + 1`,
        lastError: null,
        processedAt: new Date(),
        status: "processed",
      })
      .where(eq(core_payments_webhook_events.id, event.id));
  } catch (error) {
    const message = describePaymentsError(error);

    await db
      .update(core_payments_webhook_events)
      .set({
        attempts: sql`${core_payments_webhook_events.attempts} + 1`,
        lastError: message,
        status: "failed",
      })
      .where(eq(core_payments_webhook_events.id, event.id));

    await c
      .get("log")
      .error(
        `[Payments] Webhook ${event.type} (${event.externalId}) failed: ${message}`,
      );

    if (!isPermanentPaymentsError(error)) throw error;
  }
};

/** Queues a failed event again. Processing is idempotent, so this is too. */
export const retryWebhookEvent = async (
  c: PaymentsContext,
  eventId: number,
): Promise<boolean> =>
  await c.get("db").transaction(async tx => {
    const [row] = await tx
      .update(core_payments_webhook_events)
      .set({ status: "pending" })
      .where(
        and(
          eq(core_payments_webhook_events.id, eventId),
          inArray(core_payments_webhook_events.status, ["failed"]),
        ),
      )
      .returning({ id: core_payments_webhook_events.id });

    if (!row) return false;

    await c.get("queue").dispatch({
      maxAttempts: 8,
      name: PROCESS_EVENT_TASK,
      payload: { eventId },
      pluginId: "@vitnode/core",
      tx,
    });

    return true;
  });
