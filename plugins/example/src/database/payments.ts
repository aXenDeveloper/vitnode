import { core_users } from "@vitnode/core/database/users";
import { camelCase, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * What the example plugin's offers unlock. Core owns billing; this table is the
 * plugin's own business state - one row per user and offer.
 *
 * `accessUntil` is `null` for something bought once and kept, and the paid-
 * through date for a subscription. Every read compares it with the clock, so
 * access ends on time even if nothing runs at that moment.
 */
export const example_payments_access = camelCase.table.withRLS(
  "example_payments_access",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .references(() => core_users.id, { onDelete: "cascade" })
      .notNull(),
    offerId: t.varchar({ length: 64 }).notNull(),
    /** Core's public purchase id that granted it. */
    purchaseId: t.uuid().notNull(),
    accessUntil: t.timestamp(),
    revokedAt: t.timestamp(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("example_payments_access_user_offer_unique").on(
      t.userId,
      t.offerId,
    ),
  ],
);
