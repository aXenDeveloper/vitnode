import { camelCase } from "drizzle-orm/pg-core";

export const core_secrets = camelCase.table.withRLS("core_secrets", t => ({
  name: t.varchar({ length: 100 }).primaryKey(),
  value: t.text().notNull(),
  createdAt: t.timestamp().notNull().defaultNow(),
}));
