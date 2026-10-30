import { sql } from "drizzle-orm";
import {
  camelCase,
  check,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { core_users } from "./users";

/** Every status a payment attempt can be in. See `PAYMENT_TRANSITIONS`. */
export const PAYMENT_STATUSES = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "expired",
] as const;

/**
 * One payment attempt: a single hosted checkout for one business reference.
 * A purchase that is retried after its checkout expired gets a new row with
 * the same `reference`; only one row per reference may be open at a time.
 */
export const core_payments = camelCase.table.withRLS(
  "core_payments",
  t => ({
    id: t.uuid().primaryKey(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    reference: t.varchar({ length: 255 }).notNull(),
    userId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    providerId: t.varchar({ length: 100 }).notNull(),
    providerType: t.varchar({ length: 50 }).notNull(),
    amount: t.bigint({ mode: "number" }).notNull(),
    currency: t.varchar({ length: 3 }).notNull(),
    description: t.varchar({ length: 255 }).notNull(),
    status: t
      .varchar({ enum: PAYMENT_STATUSES, length: 20 })
      .notNull()
      .default("pending"),
    providerStatus: t.varchar({ length: 50 }),
    checkoutId: t.varchar({ length: 255 }),
    checkoutUrl: t.text(),
    livemode: t.boolean(),
    errorCode: t.varchar({ length: 64 }),
    expiresAt: t.timestamp().notNull(),
    syncedAt: t.timestamp(),
    completedAt: t.timestamp(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    check("core_payments_amount_positive", sql`"amount" > 0`),
    uniqueIndex("core_payments_open_reference_unique")
      .on(t.pluginId, t.reference)
      .where(sql`status IN ('pending', 'processing')`),
    uniqueIndex("core_payments_checkout_unique")
      .on(t.providerId, t.checkoutId)
      .where(sql`"checkoutId" IS NOT NULL`),
    index("core_payments_reference_idx").on(t.pluginId, t.reference),
    index("core_payments_user_id_idx").on(t.userId),
    index("core_payments_open_updated_at_idx")
      .on(t.updatedAt)
      .where(sql`status IN ('pending', 'processing')`),
  ],
);

/**
 * Provider webhook events already processed, so a redelivered event is
 * acknowledged without being applied twice. Only identifiers are kept, never
 * the payload.
 */
export const core_payments_webhook_events = camelCase.table.withRLS(
  "core_payments_webhook_events",
  t => ({
    providerId: t.varchar({ length: 100 }).notNull(),
    eventId: t.varchar({ length: 255 }).notNull(),
    type: t.varchar({ length: 100 }).notNull(),
    paymentId: t.uuid().references(() => core_payments.id, {
      onDelete: "set null",
    }),
    receivedAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    primaryKey({ columns: [t.providerId, t.eventId] }),
    index("core_payments_webhook_events_received_at_idx").on(t.receivedAt),
  ],
);
