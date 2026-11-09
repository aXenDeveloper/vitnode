import type { VitNodeApiConfig } from "@/vitnode.config";

import { AUDIT_DEFAULT_RETENTION_DAYS } from "@/lib/audit/const";

/**
 * The retention period from `activityLogs.retentionDays` in the API config:
 * a whole number of days from `0` (keep everything), else the default.
 */
export const resolveAuditRetentionDays = (
  config: VitNodeApiConfig["activityLogs"],
): number => {
  const days = config?.retentionDays;

  return typeof days === "number" && Number.isSafeInteger(days) && days >= 0
    ? days
    : AUDIT_DEFAULT_RETENTION_DAYS;
};
