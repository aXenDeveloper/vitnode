import type { Table } from "drizzle-orm";

import { getTableName } from "drizzle-orm";

/**
 * For statement-recording database mocks: answers inserts into
 * `core_audit_logs` on its own, so the audit entry every audited write adds
 * neither consumes the scripted results nor shows up among the recorded
 * statements - and can be asserted on separately through `entries`.
 */
export const createAuditRecorder = () => {
  const entries: Record<string, unknown>[] = [];

  return {
    entries,
    /** The audit insert builder, or `null` for any other table. */
    insert: (table: unknown) => {
      if (getTableName(table as Table) !== "core_audit_logs") return null;

      return {
        values: (value: Record<string, unknown>) => {
          entries.push(value);

          return {
            returning: async () => Promise.resolve([{ id: entries.length }]),
          };
        },
      };
    },
  };
};
