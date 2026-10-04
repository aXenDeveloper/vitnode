import { and, asc, eq, inArray, lt, lte } from "drizzle-orm";

import {
  core_payments_checkouts,
  core_payments_fulfillments,
  core_payments_purchases,
  core_payments_subscriptions,
  core_payments_webhook_events,
} from "@/database/payments";

import type { PaymentsContext } from "./shared";

import { FULFILL_TASK } from "./fulfillment";
import { describePaymentsError, providerForRow } from "./shared";
import { refreshPurchase, syncSubscription } from "./sync";
import { PROCESS_EVENT_TASK } from "./webhooks";

/** Rows looked at per kind per run - a run never walks the whole history. */
export const RECONCILE_BATCH = 25;
const RECONCILE_LOCK = "payments:reconcile";
const MINUTE = 60_000;
/** Queue work older than this with no progress is assumed lost and re-queued. */
const STUCK_AFTER_MS = 30 * MINUTE;
/** Backoff after a reconciliation attempt that could not reach the provider. */
const RETRY_AFTER_MS = 60 * MINUTE;
const RETENTION_DELETE_BATCH = 500;

export interface ReconcileReport {
  purchases: number;
  queued: number;
  subscriptions: number;
  trimmedEvents: number;
}

const reconcilePurchases = async (
  c: PaymentsContext,
  now: Date,
): Promise<number> => {
  const db = c.get("db");
  const due = await db
    .select()
    .from(core_payments_purchases)
    .where(
      and(
        inArray(core_payments_purchases.paymentStatus, [
          "awaiting_payment",
          "processing",
        ]),
        lte(core_payments_purchases.nextCheckAt, now),
      ),
    )
    .orderBy(asc(core_payments_purchases.nextCheckAt))
    .limit(RECONCILE_BATCH);

  for (const purchase of due) {
    try {
      const provider = providerForRow(c, purchase);
      const refreshed = await refreshPurchase(c, provider, purchase);

      if (
        refreshed.paymentStatus === "awaiting_payment" &&
        refreshed.nextCheckAt?.getTime() === purchase.nextCheckAt?.getTime()
      ) {
        // Nothing the provider knows about (the create never landed) and the
        // checkout window is long gone - the attempt is over.
        const [live] = await db
          .select({ id: core_payments_checkouts.id })
          .from(core_payments_checkouts)
          .where(
            and(
              eq(core_payments_checkouts.purchaseId, purchase.id),
              eq(core_payments_checkouts.status, "open"),
            ),
          )
          .limit(1);

        await db
          .update(core_payments_purchases)
          .set(
            live
              ? { nextCheckAt: new Date(now.getTime() + RETRY_AFTER_MS) }
              : { nextCheckAt: null, paymentStatus: "expired" },
          )
          .where(
            and(
              eq(core_payments_purchases.id, purchase.id),
              eq(core_payments_purchases.paymentStatus, "awaiting_payment"),
            ),
          );
      }
    } catch (error) {
      await db
        .update(core_payments_purchases)
        .set({
          lastError: describePaymentsError(error),
          nextCheckAt: new Date(now.getTime() + RETRY_AFTER_MS),
        })
        .where(eq(core_payments_purchases.id, purchase.id));
    }
  }

  return due.length;
};

const reconcileSubscriptions = async (
  c: PaymentsContext,
  now: Date,
): Promise<number> => {
  const db = c.get("db");
  const due = await db
    .select()
    .from(core_payments_subscriptions)
    .where(lte(core_payments_subscriptions.nextCheckAt, now))
    .orderBy(asc(core_payments_subscriptions.nextCheckAt))
    .limit(RECONCILE_BATCH);

  for (const subscription of due) {
    try {
      await syncSubscription(
        c,
        providerForRow(c, subscription),
        subscription.externalId,
      );
    } catch (error) {
      await db
        .update(core_payments_subscriptions)
        .set({
          lastError: describePaymentsError(error),
          nextCheckAt: new Date(now.getTime() + RETRY_AFTER_MS),
        })
        .where(eq(core_payments_subscriptions.id, subscription.id));
    }
  }

  return due.length;
};

/**
 * Queue rows are deleted a week after they finish, and a worker can die
 * mid-task - so pending payment work that has not moved for a while is put
 * back on the queue. Running it twice is harmless; never running it is not.
 */
const requeueStuckWork = async (
  c: PaymentsContext,
  now: Date,
): Promise<number> => {
  const db = c.get("db");
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);

  const fulfillments = await db
    .update(core_payments_fulfillments)
    .set({ updatedAt: now })
    .where(
      inArray(
        core_payments_fulfillments.id,
        db
          .select({ id: core_payments_fulfillments.id })
          .from(core_payments_fulfillments)
          .where(
            and(
              eq(core_payments_fulfillments.status, "pending"),
              lt(core_payments_fulfillments.updatedAt, cutoff),
            ),
          )
          .limit(RECONCILE_BATCH),
      ),
    )
    .returning({ id: core_payments_fulfillments.id });

  const events = await db
    .update(core_payments_webhook_events)
    .set({ receivedAt: now })
    .where(
      inArray(
        core_payments_webhook_events.id,
        db
          .select({ id: core_payments_webhook_events.id })
          .from(core_payments_webhook_events)
          .where(
            and(
              eq(core_payments_webhook_events.status, "pending"),
              lt(core_payments_webhook_events.receivedAt, cutoff),
            ),
          )
          .limit(RECONCILE_BATCH),
      ),
    )
    .returning({ id: core_payments_webhook_events.id });

  for (const { id } of fulfillments) {
    await c.get("queue").dispatch({
      maxAttempts: 5,
      name: FULFILL_TASK,
      payload: { fulfillmentId: id },
      pluginId: "@vitnode/core",
    });
  }

  for (const { id } of events) {
    await c.get("queue").dispatch({
      maxAttempts: 8,
      name: PROCESS_EVENT_TASK,
      payload: { eventId: id },
      pluginId: "@vitnode/core",
    });
  }

  return fulfillments.length + events.length;
};

/** Processed events lose their row after the retention window. Failed ones stay. */
const trimProcessedEvents = async (
  c: PaymentsContext,
  now: Date,
): Promise<number> => {
  const config = c.get("core").payments.config;
  if (!config) return 0;

  const db = c.get("db");
  const cutoff = new Date(
    now.getTime() - config.webhookRetentionDays * 24 * 60 * MINUTE,
  );
  const deleted = await db
    .delete(core_payments_webhook_events)
    .where(
      inArray(
        core_payments_webhook_events.id,
        db
          .select({ id: core_payments_webhook_events.id })
          .from(core_payments_webhook_events)
          .where(
            and(
              eq(core_payments_webhook_events.status, "processed"),
              lt(core_payments_webhook_events.processedAt, cutoff),
            ),
          )
          .limit(RETENTION_DELETE_BATCH),
      ),
    )
    .returning({ id: core_payments_webhook_events.id });

  return deleted.length;
};

/**
 * One bounded pass over payment work that may have missed its webhook: open
 * checkouts past their window, payments stuck in processing, subscriptions due
 * a renewal check, and queue work that never ran. Every query is limited and
 * index-backed, and each row schedules its own next check.
 */
export const reconcilePayments = async (
  c: PaymentsContext,
  now = new Date(),
): Promise<null | ReconcileReport> => {
  // Without config there is nothing to talk to - history is left as it is.
  if (!c.get("core").payments.config) return null;

  const cache = c.get("cache");
  if (!(await cache.acquireLock(RECONCILE_LOCK, 240))) return null;

  try {
    return {
      purchases: await reconcilePurchases(c, now),
      queued: await requeueStuckWork(c, now),
      subscriptions: await reconcileSubscriptions(c, now),
      trimmedEvents: await trimProcessedEvents(c, now),
    };
  } finally {
    await cache.releaseLock(RECONCILE_LOCK);
  }
};
