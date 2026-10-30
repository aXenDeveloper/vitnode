import { inArray, lt } from "drizzle-orm";

import { core_audit_logs } from "@/database/audit";
import { AUDIT_RETENTION_BATCH_SIZE } from "@/lib/audit/const";

import type { AuditDatabase } from "./write";

/** Batches one retention run deletes at most, so a huge backlog spreads over several runs. */
export const AUDIT_RETENTION_MAX_BATCHES = 100;

/**
 * Deletes entries older than `retentionDays`, oldest first, in batches of
 * {@link AUDIT_RETENTION_BATCH_SIZE} - each its own statement, so the table is
 * never locked for long. `0` keeps everything. Only the retention cron calls
 * this; no route deletes an entry.
 *
 * @returns How many entries were deleted.
 */
export const pruneAuditLogs = async (
  db: AuditDatabase,
  { now = new Date(), retentionDays }: { now?: Date; retentionDays: number },
): Promise<number> => {
  if (retentionDays <= 0) return 0;

  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  let deleted = 0;
  for (let batch = 0; batch < AUDIT_RETENTION_MAX_BATCHES; batch++) {
    const rows = await db
      .delete(core_audit_logs)
      .where(
        inArray(
          core_audit_logs.id,
          db
            .select({ id: core_audit_logs.id })
            .from(core_audit_logs)
            .where(lt(core_audit_logs.createdAt, cutoff))
            .orderBy(core_audit_logs.createdAt)
            .limit(AUDIT_RETENTION_BATCH_SIZE),
        ),
      )
      .returning({ id: core_audit_logs.id });
    deleted += rows.length;
    if (rows.length < AUDIT_RETENTION_BATCH_SIZE) break;
  }

  return deleted;
};
