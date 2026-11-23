import { camelCase, index, uniqueIndex } from "drizzle-orm/pg-core";

import { core_notification_events } from "./notifications";
import { core_users } from "./users";

/**
 * One member `@mentioned` in one target - mirrors the mentions in the
 * target's current text. The target is polymorphic (a content record or a
 * plugin's own row), so it has no foreign key: delete effects and the daily
 * cleanup remove rows of targets that are gone.
 */
export const core_mentions = camelCase.table.withRLS(
  "core_mentions",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    /** The content type id, or a custom mention target's `type`. */
    targetType: t.varchar({ length: 100 }).notNull(),
    targetId: t.varchar({ length: 100 }).notNull(),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    actorId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    /** The `core.mention` event that notified the member; retracted with the row. */
    eventId: t
      .bigint({ mode: "number" })
      .references(() => core_notification_events.id, { onDelete: "set null" }),
    notified: t.boolean().notNull().default(false),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    uniqueIndex("core_mentions_target_user_idx").on(
      t.pluginId,
      t.targetType,
      t.targetId,
      t.userId,
    ),
    index("core_mentions_user_id_idx").on(t.userId, t.createdAt),
    index("core_mentions_event_id_idx").on(t.eventId),
  ],
);
