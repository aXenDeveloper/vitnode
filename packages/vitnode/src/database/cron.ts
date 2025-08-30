import { pgTable } from "drizzle-orm/pg-core";

export const core_cron = pgTable("core_cron", t => ({
  name: t.varchar({ length: 255 }).notNull().unique().primaryKey(),
  description: t.varchar({ length: 255 }),
  lastRun: t.timestamp(),
})).enableRLS();
