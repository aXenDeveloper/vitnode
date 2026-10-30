import { core_users } from "@vitnode/core/database/users";
import { camelCase, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * One member's purchase of one demo item. Whether it is paid is not stored
 * here: it is derived from core's payments for the reference
 * `purchase:{id}`, so a crash between the payment and this table can never
 * lose or double a purchase.
 */
export const payments_demo_purchases = camelCase.table.withRLS(
  "payments_demo_purchases",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    itemId: t.varchar({ length: 50 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    uniqueIndex("payments_demo_purchases_user_item_unique").on(
      t.userId,
      t.itemId,
    ),
  ],
);
