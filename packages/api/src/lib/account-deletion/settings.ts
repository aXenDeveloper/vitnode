import type { VitNodeApiConfig } from "@/vitnode.config";

export const ACCOUNT_DELETION_DEFAULT_GRACE_DAYS = 14;
/** GDPR Art. 12(3) gives a month to act on a request; the grace period must fit in it. */
export const ACCOUNT_DELETION_MAX_GRACE_DAYS = 30;
export const IP_RETENTION_DEFAULT_DAYS = 180;

const wholeDays = (value: unknown): null | number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;

export interface PrivacySettings {
  /** Days between a member asking to delete their account and the erasure. */
  deletionGraceDays: number;
  /** Days IP addresses are kept in logs and on accounts; `0` keeps them. */
  ipRetentionDays: number;
}

/** `users.accountDeletion` and `users.ipRetentionDays`, with defaults and bounds applied. */
export const resolvePrivacySettings = (
  users: VitNodeApiConfig["users"],
): PrivacySettings => ({
  deletionGraceDays: Math.min(
    wholeDays(users?.accountDeletion?.graceDays) ??
      ACCOUNT_DELETION_DEFAULT_GRACE_DAYS,
    ACCOUNT_DELETION_MAX_GRACE_DAYS,
  ),
  ipRetentionDays:
    wholeDays(users?.ipRetentionDays) ?? IP_RETENTION_DEFAULT_DAYS,
});
