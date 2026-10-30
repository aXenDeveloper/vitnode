import { eq } from "drizzle-orm";

import { core_audit_settings } from "@/database/audit";
import { AUDIT_DEFAULT_RETENTION_DAYS } from "@/lib/audit/const";

import type { AuditDatabase } from "./write";

/** The Activity Logs settings, with their defaults applied. */
export interface AuditSettings {
  /** Days an entry is kept. `0` keeps everything. */
  retentionDays: number;
}

export const loadAuditSettings = async (
  db: AuditDatabase,
): Promise<AuditSettings> => {
  const [row] = await db
    .select({ retentionDays: core_audit_settings.retentionDays })
    .from(core_audit_settings)
    .where(eq(core_audit_settings.id, 1))
    .limit(1);

  return { retentionDays: row?.retentionDays ?? AUDIT_DEFAULT_RETENTION_DAYS };
};

export const saveAuditSettings = async (
  db: AuditDatabase,
  settings: AuditSettings,
): Promise<void> => {
  await db
    .insert(core_audit_settings)
    .values({ id: 1, ...settings })
    .onConflictDoUpdate({ set: settings, target: core_audit_settings.id });
};
