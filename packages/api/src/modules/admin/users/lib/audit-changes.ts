import type { AuditChanges } from "@/lib/audit/const";

import { auditDiff } from "@/lib/audit/diff";

/** Account fields an audit entry may show the values of: none of them is private. */
const VISIBLE_FIELDS = [
  "language",
  "name",
  "nameCode",
  "newsletter",
  "roleId",
  "timeZone",
] as const;

/**
 * The audit changes of an AdminCP edit of a user. Roles, names and preferences
 * keep their values; personal data (email, birthday, real name, phone...) is
 * recorded only as changed, never with its values - an audit trail is no
 * reason to keep a second copy of somebody's address. A field only counts as
 * changed when its value differs from `before`, so `before` must hold every
 * field `after` may carry.
 */
export const adminUserAuditChanges = ({
  after,
  before,
  secondaryRoleIds,
}: {
  after: Record<string, unknown>;
  before: Record<string, unknown>;
  secondaryRoleIds?: { after: number[]; before: number[] };
}): AuditChanges | null => {
  const isVisible = (field: string) =>
    (VISIBLE_FIELDS as readonly string[]).includes(field);
  const changes: AuditChanges = {};
  for (const [field, change] of Object.entries(
    auditDiff({ after, before, include: Object.keys(after) }) ?? {},
  )) {
    changes[field] = isVisible(field) ? change : { redacted: true };
  }

  if (secondaryRoleIds) {
    const from = [...secondaryRoleIds.before].sort((a, b) => a - b);
    const to = [...secondaryRoleIds.after].sort((a, b) => a - b);
    if (from.join(",") !== to.join(",")) {
      changes.secondaryRoleIds = { from, to };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
};
