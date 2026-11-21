import { and, inArray, isNotNull, lt } from "drizzle-orm";

import type { AuditDatabase } from "@/lib/audit/write";

import { core_audit_logs } from "@/database/audit";
import { core_logs } from "@/database/logs";
import { core_users } from "@/database/users";

const BATCH_SIZE = 1000;
const MAX_BATCHES = 100;

/** Runs `step` until it touches fewer rows than a batch, at most {@link MAX_BATCHES} times. */
const inBatches = async (step: () => Promise<number>): Promise<number> => {
  let total = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const count = await step();
    total += count;
    if (count < BATCH_SIZE) break;
  }

  return total;
};

/**
 * Forgets IP addresses older than `retentionDays`: deletes debug logs (an IP
 * is most of what they hold) and clears the IP on Activity Logs entries and
 * on accounts' sign-up record. `0` keeps everything. Batched, so no table is
 * locked for long. Only the `ip-retention` cron calls this.
 */
export const pruneIpAddresses = async (
  db: AuditDatabase,
  { now = new Date(), retentionDays }: { now?: Date; retentionDays: number },
): Promise<{ accounts: number; activityLogs: number; logs: number }> => {
  if (retentionDays <= 0) return { accounts: 0, activityLogs: 0, logs: 0 };

  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);

  const logs = await inBatches(async () => {
    const rows = await db
      .delete(core_logs)
      .where(
        inArray(
          core_logs.id,
          db
            .select({ id: core_logs.id })
            .from(core_logs)
            .where(lt(core_logs.createdAt, cutoff))
            .limit(BATCH_SIZE),
        ),
      )
      .returning({ id: core_logs.id });

    return rows.length;
  });

  const activityLogs = await inBatches(async () => {
    const rows = await db
      .update(core_audit_logs)
      .set({ ipAddress: null })
      .where(
        inArray(
          core_audit_logs.id,
          db
            .select({ id: core_audit_logs.id })
            .from(core_audit_logs)
            .where(
              and(
                isNotNull(core_audit_logs.ipAddress),
                lt(core_audit_logs.createdAt, cutoff),
              ),
            )
            .limit(BATCH_SIZE),
        ),
      )
      .returning({ id: core_audit_logs.id });

    return rows.length;
  });

  const accounts = await inBatches(async () => {
    const rows = await db
      .update(core_users)
      .set({ ipAddress: null })
      .where(
        inArray(
          core_users.id,
          db
            .select({ id: core_users.id })
            .from(core_users)
            .where(
              and(
                isNotNull(core_users.ipAddress),
                lt(core_users.createdAt, cutoff),
              ),
            )
            .limit(BATCH_SIZE),
        ),
      )
      .returning({ id: core_users.id });

    return rows.length;
  });

  return { accounts, activityLogs, logs };
};
