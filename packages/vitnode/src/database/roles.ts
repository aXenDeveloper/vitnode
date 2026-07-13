import { pgTable } from "drizzle-orm/pg-core";

export const core_roles = pgTable("core_roles", t => ({
  id: t.serial().primaryKey(),
  createdAt: t.timestamp().notNull().defaultNow(),
  updatedAt: t
    .timestamp()
    .notNull()
    .$onUpdate(() => new Date()),
  protected: t.boolean().notNull().default(false),
  default: t.boolean().notNull().default(false),
  root: t.boolean().notNull().default(false),
  guest: t.boolean().notNull().default(false),
  color: t.varchar({ length: 50 }),
})).enableRLS();
