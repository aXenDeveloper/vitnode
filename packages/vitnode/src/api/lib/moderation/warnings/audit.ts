import type { Context } from "hono";

import type { AuditDatabase } from "@/api/lib/audit/write";
import type { AuditScope } from "@/lib/audit/const";

import { writeAuditLog } from "@/api/lib/audit/write";

/** The audit actions of warnings and sanctions, all about the warned member. */
export type WarningAuditAction =
  | "sanction.applied"
  | "sanction.revoked"
  | "warning.issued"
  | "warning.revoked";

/**
 * Writes one warning or sanction entry to the central audit log, in the
 * moderators' log and in the same transaction as the change. The target is
 * the warned member, so their history reads as one moderation log. Never pass
 * staff notes, override explanations or revocation reasons in `metadata`.
 */
export const recordWarningAudit = async (
  c: Context,
  tx: AuditDatabase,
  {
    action,
    metadata,
    scope = null,
    user,
  }: {
    action: WarningAuditAction;
    metadata: Record<string, unknown>;
    scope?: AuditScope | null;
    user: { id: number; name: null | string };
  },
): Promise<void> => {
  await writeAuditLog(
    c,
    {
      action,
      area: "moderator",
      metadata,
      scope,
      target: { id: user.id, label: user.name, type: "user" },
    },
    tx,
  );
};
