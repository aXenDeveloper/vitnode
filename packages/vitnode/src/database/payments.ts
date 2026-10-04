import { sql } from "drizzle-orm";
import { camelCase, index, uniqueIndex } from "drizzle-orm/pg-core";

import {
  BILLING_INTERVALS,
  CHECKOUT_STATUSES,
  DISPUTE_STATUSES,
  FULFILLMENT_STATUSES,
  INVOICE_STATUSES,
  OFFER_MODES,
  PURCHASE_PAYMENT_STATUSES,
  REFUND_STATUSES,
  SUBSCRIPTION_STATUSES,
} from "@/payments/status";

import { core_users } from "./users";

/**
 * Billing state. Amounts are `bigint` columns read as JS numbers: every write
 * goes through `assertMinorUnits`, which keeps them inside
 * `Number.MAX_SAFE_INTEGER`, so they serialise as plain JSON numbers.
 *
 * Every provider reference is unique together with its provider and scope
 * (`test`/`live`), so ids from two environments can never collide. No card
 * details are stored anywhere.
 */

/** Which provider customer stands for which user. */
export const core_payments_customers = camelCase.table.withRLS(
  "core_payments_customers",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    provider: t.varchar({ length: 32 }).notNull(),
    providerScope: t.varchar({ length: 32 }).notNull(),
    externalId: t.varchar({ length: 255 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    uniqueIndex("core_payments_customers_user_unique").on(
      t.provider,
      t.providerScope,
      t.userId,
    ),
    uniqueIndex("core_payments_customers_external_unique").on(
      t.provider,
      t.providerScope,
      t.externalId,
    ),
  ],
);

/**
 * One thing a user set out to buy, with a snapshot of the offer as it was.
 * Removing or repricing the offer later never changes this row.
 */
export const core_payments_purchases = camelCase.table.withRLS(
  "core_payments_purchases",
  t => ({
    id: t.serial().primaryKey(),
    publicId: t.uuid().notNull().defaultRandom(),
    // `set null`, not `cascade`: a billing record outlives the account it was
    // charged to.
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    pluginId: t.varchar({ length: 100 }).notNull(),
    offerId: t.varchar({ length: 64 }).notNull(),
    offerName: t.varchar({ length: 255 }).notNull(),
    mode: t.varchar({ enum: OFFER_MODES, length: 20 }).notNull(),
    interval: t.varchar({ enum: BILLING_INTERVALS, length: 10 }),
    amount: t.bigint({ mode: "number" }).notNull(),
    currency: t.varchar({ length: 3 }).notNull(),
    provider: t.varchar({ length: 32 }).notNull(),
    providerScope: t.varchar({ length: 32 }).notNull(),
    externalCustomerId: t.varchar({ length: 255 }),
    /** The one-time payment the checkout produced. */
    externalPaymentId: t.varchar({ length: 255 }),
    paymentStatus: t
      .varchar({ enum: PURCHASE_PAYMENT_STATUSES, length: 20 })
      .notNull()
      .default("awaiting_payment"),
    fulfillmentStatus: t
      .varchar({ enum: FULFILLMENT_STATUSES, length: 20 })
      .notNull()
      .default("not_started"),
    refundStatus: t
      .varchar({ enum: REFUND_STATUSES, length: 10 })
      .notNull()
      .default("none"),
    refundedAmount: t.bigint({ mode: "number" }).notNull().default(0),
    disputeStatus: t.varchar({ enum: DISPUTE_STATUSES, length: 10 }),
    /** Client-supplied, scoped to the buyer. */
    idempotencyKey: t.varchar({ length: 100 }),
    /** Hash of the resolved operation, to refuse a reused key. */
    requestHash: t.varchar({ length: 64 }).notNull(),
    lastError: t.text(),
    /** When reconciliation should next ask the provider about this one. */
    nextCheckAt: t.timestamp(),
    paidAt: t.timestamp(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_payments_purchases_public_id_unique").on(t.publicId),
    uniqueIndex("core_payments_purchases_idempotency_unique")
      .on(t.userId, t.idempotencyKey)
      .where(sql`"idempotencyKey" IS NOT NULL`),
    // At most one unfinished purchase per buyer and offer. The checkout path
    // also takes a lock, this is what holds when everything else races.
    uniqueIndex("core_payments_purchases_open_unique")
      .on(t.userId, t.pluginId, t.offerId)
      .where(sql`"paymentStatus" IN ('awaiting_payment', 'processing')`),
    uniqueIndex("core_payments_purchases_payment_unique")
      .on(t.provider, t.providerScope, t.externalPaymentId)
      .where(sql`"externalPaymentId" IS NOT NULL`),
    index("core_payments_purchases_user_created_idx").on(t.userId, t.createdAt),
    index("core_payments_purchases_created_idx").on(t.createdAt, t.id),
    index("core_payments_purchases_reconcile_idx")
      .on(t.nextCheckAt)
      .where(sql`"paymentStatus" IN ('awaiting_payment', 'processing')`),
  ],
);

/** One hosted checkout for a purchase. A failed creation can be retried. */
export const core_payments_checkouts = camelCase.table.withRLS(
  "core_payments_checkouts",
  t => ({
    id: t.serial().primaryKey(),
    purchaseId: t
      .integer()
      .references(() => core_payments_purchases.id, { onDelete: "cascade" })
      .notNull(),
    provider: t.varchar({ length: 32 }).notNull(),
    providerScope: t.varchar({ length: 32 }).notNull(),
    externalId: t.varchar({ length: 255 }),
    url: t.text(),
    status: t
      .varchar({ enum: CHECKOUT_STATUSES, length: 20 })
      .notNull()
      .default("creating"),
    /** Sent to the provider, so a retried create returns the same checkout. */
    idempotencyKey: t.varchar({ length: 100 }).notNull(),
    expiresAt: t.timestamp().notNull(),
    lastError: t.text(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_payments_checkouts_idempotency_unique").on(
      t.idempotencyKey,
    ),
    uniqueIndex("core_payments_checkouts_external_unique")
      .on(t.provider, t.providerScope, t.externalId)
      .where(sql`"externalId" IS NOT NULL`),
    index("core_payments_checkouts_purchase_idx").on(t.purchaseId, t.id),
  ],
);

export const core_payments_subscriptions = camelCase.table.withRLS(
  "core_payments_subscriptions",
  t => ({
    id: t.serial().primaryKey(),
    publicId: t.uuid().notNull().defaultRandom(),
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    /** The purchase that started it - and its offer snapshot. */
    purchaseId: t
      .integer()
      .references(() => core_payments_purchases.id, { onDelete: "restrict" })
      .notNull(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    offerId: t.varchar({ length: 64 }).notNull(),
    offerName: t.varchar({ length: 255 }).notNull(),
    interval: t.varchar({ enum: BILLING_INTERVALS, length: 10 }).notNull(),
    /** What this subscriber pays, as the provider holds it. */
    amount: t.bigint({ mode: "number" }).notNull(),
    currency: t.varchar({ length: 3 }).notNull(),
    provider: t.varchar({ length: 32 }).notNull(),
    providerScope: t.varchar({ length: 32 }).notNull(),
    externalId: t.varchar({ length: 255 }).notNull(),
    externalCustomerId: t.varchar({ length: 255 }).notNull(),
    externalPriceId: t.varchar({ length: 255 }),
    status: t.varchar({ enum: SUBSCRIPTION_STATUSES, length: 20 }).notNull(),
    providerStatus: t.varchar({ length: 50 }).notNull(),
    /** End of the latest period a verified paid invoice covers. */
    paidThrough: t.timestamp(),
    currentPeriodEnd: t.timestamp(),
    cancelAtPeriodEnd: t.boolean().notNull().default(false),
    cancelAt: t.timestamp(),
    canceledAt: t.timestamp(),
    endedAt: t.timestamp(),
    syncedAt: t.timestamp().notNull().defaultNow(),
    nextCheckAt: t.timestamp(),
    lastError: t.text(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_payments_subscriptions_public_id_unique").on(t.publicId),
    uniqueIndex("core_payments_subscriptions_purchase_unique").on(t.purchaseId),
    uniqueIndex("core_payments_subscriptions_external_unique").on(
      t.provider,
      t.providerScope,
      t.externalId,
    ),
    index("core_payments_subscriptions_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
    index("core_payments_subscriptions_created_idx").on(t.createdAt, t.id),
    index("core_payments_subscriptions_reconcile_idx")
      .on(t.nextCheckAt)
      .where(sql`"nextCheckAt" IS NOT NULL`),
  ],
);

/** One recurring charge - initial or renewal - of a subscription. */
export const core_payments_invoices = camelCase.table.withRLS(
  "core_payments_invoices",
  t => ({
    id: t.serial().primaryKey(),
    subscriptionId: t
      .integer()
      .references(() => core_payments_subscriptions.id, { onDelete: "cascade" })
      .notNull(),
    provider: t.varchar({ length: 32 }).notNull(),
    providerScope: t.varchar({ length: 32 }).notNull(),
    externalId: t.varchar({ length: 255 }).notNull(),
    externalPaymentId: t.varchar({ length: 255 }),
    status: t.varchar({ enum: INVOICE_STATUSES, length: 20 }).notNull(),
    providerStatus: t.varchar({ length: 50 }).notNull(),
    billingReason: t.varchar({ length: 50 }),
    amountDue: t.bigint({ mode: "number" }).notNull(),
    amountPaid: t.bigint({ mode: "number" }).notNull().default(0),
    currency: t.varchar({ length: 3 }).notNull(),
    periodStart: t.timestamp(),
    periodEnd: t.timestamp(),
    paidAt: t.timestamp(),
    refundStatus: t
      .varchar({ enum: REFUND_STATUSES, length: 10 })
      .notNull()
      .default("none"),
    refundedAmount: t.bigint({ mode: "number" }).notNull().default(0),
    disputeStatus: t.varchar({ enum: DISPUTE_STATUSES, length: 10 }),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_payments_invoices_external_unique").on(
      t.provider,
      t.providerScope,
      t.externalId,
    ),
    uniqueIndex("core_payments_invoices_payment_unique")
      .on(t.provider, t.providerScope, t.externalPaymentId)
      .where(sql`"externalPaymentId" IS NOT NULL`),
    index("core_payments_invoices_subscription_idx").on(
      t.subscriptionId,
      t.createdAt,
    ),
  ],
);

/**
 * Refunds and disputes, each attributed to the one-time purchase or the
 * recurring invoice it belongs to. The original paid amount is never touched.
 */
export const core_payments_adjustments = camelCase.table.withRLS(
  "core_payments_adjustments",
  t => ({
    id: t.serial().primaryKey(),
    kind: t.varchar({ enum: ["refund", "dispute"], length: 10 }).notNull(),
    provider: t.varchar({ length: 32 }).notNull(),
    providerScope: t.varchar({ length: 32 }).notNull(),
    externalId: t.varchar({ length: 255 }).notNull(),
    purchaseId: t
      .integer()
      .references(() => core_payments_purchases.id, { onDelete: "cascade" }),
    invoiceId: t
      .integer()
      .references(() => core_payments_invoices.id, { onDelete: "cascade" }),
    amount: t.bigint({ mode: "number" }).notNull(),
    currency: t.varchar({ length: 3 }).notNull(),
    status: t.varchar({ length: 30 }).notNull(),
    reason: t.varchar({ length: 100 }),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_payments_adjustments_external_unique").on(
      t.provider,
      t.providerScope,
      t.kind,
      t.externalId,
    ),
    index("core_payments_adjustments_purchase_idx").on(t.purchaseId),
    index("core_payments_adjustments_invoice_idx").on(t.invoiceId),
  ],
);

/**
 * The webhook inbox. A row exists once an event was verified and accepted;
 * processing happens in the queue. Only the normalized target is stored - the
 * raw provider payload is never kept.
 */
export const core_payments_webhook_events = camelCase.table.withRLS(
  "core_payments_webhook_events",
  t => ({
    id: t.serial().primaryKey(),
    provider: t.varchar({ length: 32 }).notNull(),
    providerScope: t.varchar({ length: 32 }).notNull(),
    externalId: t.varchar({ length: 255 }).notNull(),
    type: t.varchar({ length: 100 }).notNull(),
    target: t.jsonb().$type<Record<string, string>>().notNull(),
    status: t
      .varchar({ enum: ["pending", "processed", "failed"], length: 20 })
      .notNull()
      .default("pending"),
    attempts: t.integer().notNull().default(0),
    lastError: t.text(),
    receivedAt: t.timestamp().notNull().defaultNow(),
    processedAt: t.timestamp(),
  }),
  t => [
    uniqueIndex("core_payments_webhook_events_external_unique").on(
      t.provider,
      t.providerScope,
      t.externalId,
    ),
    index("core_payments_webhook_events_status_idx").on(t.status, t.receivedAt),
  ],
);

/**
 * One business effect of a purchase - "grant", "refund:<id>",
 * "subscription". Unique per purchase, so a retried job finds the row it
 * already completed instead of granting twice. A subscription's row is reused:
 * `generation` moves on every change and the handler runs until
 * `completedGeneration` catches up.
 */
export const core_payments_fulfillments = camelCase.table.withRLS(
  "core_payments_fulfillments",
  t => ({
    id: t.serial().primaryKey(),
    purchaseId: t
      .integer()
      .references(() => core_payments_purchases.id, { onDelete: "cascade" })
      .notNull(),
    effect: t.varchar({ length: 100 }).notNull(),
    payload: t
      .jsonb()
      .$type<Record<string, number | string>>()
      .notNull()
      .default({}),
    status: t
      .varchar({ enum: ["pending", "completed", "failed"], length: 20 })
      .notNull()
      .default("pending"),
    generation: t.integer().notNull().default(1),
    completedGeneration: t.integer().notNull().default(0),
    attempts: t.integer().notNull().default(0),
    lastError: t.text(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    completedAt: t.timestamp(),
  }),
  t => [
    uniqueIndex("core_payments_fulfillments_effect_unique").on(
      t.purchaseId,
      t.effect,
    ),
    index("core_payments_fulfillments_status_idx").on(t.status, t.updatedAt),
  ],
);
