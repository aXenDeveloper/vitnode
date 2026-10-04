import { and, count, eq, inArray, lt, sql, sum } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { loadCronHealth } from "@/api/modules/cron/helpers/load-cron-health";
import { CONFIG_PLUGIN } from "@/config";
import {
  core_payments_fulfillments,
  core_payments_invoices,
  core_payments_purchases,
  core_payments_subscriptions,
  core_payments_webhook_events,
} from "@/database/payments";
import { core_queue } from "@/database/queue";

const QUEUE_LAG_MINUTES = 10;

const toNumber = (value: null | number | string | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

export const paymentsOverviewAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "payments", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Payments health: totals per currency (never mixed), work that needs attention, and whether the queue worker is running.",
    path: "/overview",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              attention: z.object({
                disputesOpen: z.number(),
                eventsFailed: z.number(),
                fulfillmentsFailed: z.number(),
                fulfillmentsPending: z.number(),
                purchasesProcessing: z.number(),
                subscriptionsNeedingAttention: z.number(),
              }),
              enabled: z.boolean(),
              providers: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  scope: z.string(),
                }),
              ),
              totals: z.array(
                z.object({
                  currency: z.string(),
                  oneTime: z.number(),
                  recurring: z.number(),
                  refunded: z.number(),
                }),
              ),
              worker: z.object({
                hasCronAdapter: z.boolean(),
                lastRun: z.date().nullable(),
                queueLagging: z.number(),
                stale: z.boolean(),
              }),
            }),
          },
        },
        description: "Payments overview",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const config = c.get("core").payments.config;
    const now = Date.now();

    const [oneTime, recurring, attention, health, lagging] = await Promise.all([
      db
        .select({
          amount: sum(core_payments_purchases.amount),
          currency: core_payments_purchases.currency,
          refunded: sum(core_payments_purchases.refundedAmount),
        })
        .from(core_payments_purchases)
        .where(
          and(
            eq(core_payments_purchases.mode, "one_time"),
            eq(core_payments_purchases.paymentStatus, "paid"),
          ),
        )
        .groupBy(core_payments_purchases.currency),
      db
        .select({
          amount: sum(core_payments_invoices.amountPaid),
          currency: core_payments_invoices.currency,
          refunded: sum(core_payments_invoices.refundedAmount),
        })
        .from(core_payments_invoices)
        .where(eq(core_payments_invoices.status, "paid"))
        .groupBy(core_payments_invoices.currency),
      Promise.all([
        db
          .select({ value: count() })
          .from(core_payments_purchases)
          .where(eq(core_payments_purchases.disputeStatus, "open")),
        db
          .select({ value: count() })
          .from(core_payments_webhook_events)
          .where(eq(core_payments_webhook_events.status, "failed")),
        db
          .select({ value: count() })
          .from(core_payments_fulfillments)
          .where(eq(core_payments_fulfillments.status, "failed")),
        db
          .select({ value: count() })
          .from(core_payments_fulfillments)
          .where(eq(core_payments_fulfillments.status, "pending")),
        db
          .select({ value: count() })
          .from(core_payments_purchases)
          .where(eq(core_payments_purchases.paymentStatus, "processing")),
        db
          .select({ value: count() })
          .from(core_payments_subscriptions)
          .where(
            inArray(core_payments_subscriptions.status, [
              "past_due",
              "unpaid",
              "paused",
              "incomplete",
            ]),
          ),
      ]),
      loadCronHealth(db),
      // Payment jobs nobody has picked up for a while: the clearest sign that
      // no worker is ticking the queue on this deployment.
      db
        .select({ value: count() })
        .from(core_queue)
        .where(
          and(
            eq(core_queue.pluginId, "@vitnode/core"),
            sql`${core_queue.name} LIKE 'payments-%'`,
            eq(core_queue.status, "pending"),
            lt(
              core_queue.availableAt,
              new Date(now - QUEUE_LAG_MINUTES * 60_000),
            ),
          ),
        ),
    ]);

    const currencies = new Set([
      ...oneTime.map(row => row.currency),
      ...recurring.map(row => row.currency),
    ]);
    const [disputes, events, failed, pending, processing, subscriptions] =
      attention.map(rows => rows[0]?.value ?? 0);

    return c.json({
      attention: {
        disputesOpen: disputes,
        eventsFailed: events,
        fulfillmentsFailed: failed,
        fulfillmentsPending: pending,
        purchasesProcessing: processing,
        subscriptionsNeedingAttention: subscriptions,
      },
      enabled: !!config,
      providers: (config?.providers ?? []).map(provider => ({
        id: provider.id,
        name: provider.name,
        scope: provider.scope,
      })),
      totals: [...currencies].sort().map(currency => {
        const once = oneTime.find(row => row.currency === currency);
        const repeat = recurring.find(row => row.currency === currency);

        return {
          currency,
          oneTime: toNumber(once?.amount),
          recurring: toNumber(repeat?.amount),
          refunded: toNumber(once?.refunded) + toNumber(repeat?.refunded),
        };
      }),
      worker: {
        hasCronAdapter: c.get("core").hasCronAdapter,
        lastRun: health.lastRun,
        queueLagging: lagging[0]?.value ?? 0,
        stale: health.stale,
      },
    });
  },
});
