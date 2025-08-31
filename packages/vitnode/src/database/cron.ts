import { pgTable } from "drizzle-orm/pg-core";

export const core_cron = pgTable("core_cron", t => ({
  id: t.serial().primaryKey(),
  name: t.varchar({ length: 255 }).notNull(),
  description: t.varchar({ length: 255 }),
  lastRun: t.timestamp(),
  createdAt: t.timestamp().notNull().defaultNow(),
  pluginId: t.varchar({ length: 100 }).notNull(),
  module: t.varchar({ length: 100 }).notNull(),
})).enableRLS();
