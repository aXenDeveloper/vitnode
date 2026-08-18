import { camelCase } from "drizzle-orm/pg-core";

export const core_cron = camelCase.table.withRLS("core_cron", t => ({
  id: t.serial().primaryKey(),
  name: t.varchar({ length: 255 }).notNull(),
  description: t.varchar({ length: 255 }),
  lastRun: t.timestamp(),
  createdAt: t.timestamp().notNull().defaultNow(),
  pluginId: t.varchar({ length: 100 }).notNull(),
  module: t.varchar({ length: 100 }).notNull(),
  nextRun: t.timestamp(),
  schedule: t.varchar({ length: 100 }).notNull(),
}));
