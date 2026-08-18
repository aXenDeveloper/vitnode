import { camelCase } from "drizzle-orm/pg-core";

/**
 * Signing keys the install generates for itself.
 *
 * A row per secret, keyed by a stable name, so a feature whose whole access
 * control is a signature does not become a deployment prerequisite: the first
 * process that needs one mints it, every other process reads the same value,
 * and it survives restarts and redeploys the way an environment variable does
 * without anyone having to set one.
 *
 * The database is the right home rather than a file or a per-process constant:
 * an install is already trusting it with the records these secrets protect, and
 * it is the one thing every API process demonstrably shares.
 *
 * Deleting a row rotates that secret - the next process to need it generates a
 * fresh one, and every token signed with the old value stops verifying.
 */
export const core_secrets = camelCase.table.withRLS("core_secrets", t => ({
  name: t.varchar({ length: 100 }).primaryKey(),
  value: t.text().notNull(),
  createdAt: t.timestamp().notNull().defaultNow(),
}));
