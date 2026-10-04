import { sql } from "drizzle-orm";
import { camelCase, index, uniqueIndex } from "drizzle-orm/pg-core";

export const core_queue = camelCase.table.withRLS(
  "core_queue",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    name: t.varchar({ length: 100 }).notNull(),
    queue: t.varchar({ length: 100 }).notNull().default("default"),
    status: t
      .varchar({
        enum: ["pending", "processing", "completed", "failed"],
        length: 20,
      })
      .notNull()
      .default("pending"),
    payload: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    priority: t.integer().notNull().default(0),
    attempts: t.integer().notNull().default(0),
    maxAttempts: t.integer().notNull().default(3),
    availableAt: t.timestamp().notNull().defaultNow(),
    reservedAt: t.timestamp(),
    lastError: t.text(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    completedAt: t.timestamp(),
    /**
     * At most one pending or running task per key: dispatching the same work
     * twice (an upload and the repair sweep) queues it once.
     */
    dedupeKey: t.varchar({ length: 255 }),
  }),
  t => [
    index("core_queue_status_available_at_idx").on(t.status, t.availableAt),
    index("core_queue_created_at_id_idx").on(t.createdAt, t.id),
    uniqueIndex("core_queue_dedupe_active_unique")
      .on(t.pluginId, t.dedupeKey)
      .where(
        sql`"dedupeKey" IS NOT NULL AND status IN ('pending', 'processing')`,
      ),
  ],
);
