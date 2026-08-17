import { camelCase, index } from "drizzle-orm/pg-core";

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
  }),
  t => [
    index("core_queue_status_available_at_idx").on(t.status, t.availableAt),
  ],
);
