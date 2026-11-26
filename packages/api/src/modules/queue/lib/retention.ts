import type { VitNodeApiConfig } from "@/vitnode.config";

export const QUEUE_DEFAULT_RETENTION_DAYS = 30;

/**
 * The retention period from `queue.retentionDays` in the API config: a whole
 * number of days from `0` (keep every finished task), else the default.
 */
export const resolveQueueRetentionDays = (
  config: VitNodeApiConfig["queue"],
): number => {
  const days = config?.retentionDays;

  return typeof days === "number" && Number.isSafeInteger(days) && days >= 0
    ? days
    : QUEUE_DEFAULT_RETENTION_DAYS;
};
