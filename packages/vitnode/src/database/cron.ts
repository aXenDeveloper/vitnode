import { pgTable } from "drizzle-orm/pg-core";

export const core_cron = pgTable("core_cron", t => ({
  id: t.serial().primaryKey(),
  name: t.varchar({ length: 255 }).notNull(),
  description: t.varchar({ length: 255 }),
  lastRun: t.timestamp(),
  createdAt: t.timestamp().notNull().defaultNow(),
})).enableRLS();
