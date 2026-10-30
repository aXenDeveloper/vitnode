import type { AuditChanges } from "./const";

import { AUDIT_RICH_TEXT } from "./const";
import {
  isRichTextDocument,
  isSensitiveAuditKey,
  sanitizeAuditChanges,
} from "./sanitize";

/** Arguments of {@link auditDiff}. */
export interface AuditDiffArgs<TField extends string = string> {
  /** The values after the operation. `null` for a deletion. */
  after: null | Partial<Record<TField, unknown>>;
  /** The values before the operation. `null` for a creation. */
  before: null | Partial<Record<TField, unknown>>;
  /**
   * Fields never compared - high-frequency counters, timestamps, derived
   * columns. Sensitive fields need no entry here: they are always redacted.
   */
  exclude?: readonly NoInfer<TField>[];
  /**
   * Compare only these fields. Prefer it for security-relevant writes: an
   * allowlist cannot leak a column added later.
   */
  include?: readonly NoInfer<TField>[];
}

const comparable = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();

  return value;
};

const sameValue = (before: unknown, after: unknown): boolean => {
  const left = comparable(before);
  const right = comparable(after);
  if (left === right) return true;
  if (left === null || right === null) return false;
  if (typeof left !== "object" || typeof right !== "object") return false;

  return JSON.stringify(left) === JSON.stringify(right);
};

/**
 * Structured before/after changes between two plain objects, ready for
 * `c.get("audit").record({ changes })`. Universal and pure.
 *
 * - Unchanged fields are left out; a transition to or from `null` is kept.
 * - A field missing on one side counts as `null` on that side.
 * - Sensitive fields (passwords, tokens, secrets, keys...) are recorded as
 *   `{ redacted: true }` - that they changed, never their values.
 * - Rich-text documents are compared by their serialized form, never
 *   diffed node by node, and stored as a marker: their history belongs to
 *   Content Revisions, not to audit logs.
 * - The result is bounded by the same limits as every audit payload.
 *
 * @returns `null` when nothing changed.
 *
 * @example
 * ```ts
 * import { auditDiff } from "@vitnode/core/lib/audit/diff";
 *
 * auditDiff({
 *   before: { name: "News", slug: "news" },
 *   after: { name: "Announcements", slug: "announcements" },
 * });
 * // { name: { from: "News", to: "Announcements" },
 * //   slug: { from: "news", to: "announcements" } }
 * ```
 */
export const auditDiff = <TField extends string>({
  after,
  before,
  exclude = [],
  include,
}: AuditDiffArgs<TField>): AuditChanges | null => {
  const left = (before ?? {}) as Record<string, unknown>;
  const right = (after ?? {}) as Record<string, unknown>;
  const excluded = new Set<string>(exclude);
  const fields = include ?? [
    ...new Set([...Object.keys(left), ...Object.keys(right)]),
  ];

  const changes: AuditChanges = {};
  for (const field of fields) {
    if (excluded.has(field)) continue;
    const from = left[field] ?? null;
    const to = right[field] ?? null;

    if (isRichTextDocument(from) || isRichTextDocument(to)) {
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes[field] = { from: AUDIT_RICH_TEXT, to: AUDIT_RICH_TEXT };
      }
      continue;
    }
    if (sameValue(from, to)) continue;

    changes[field] = isSensitiveAuditKey(field)
      ? { redacted: true }
      : { from, to };
  }

  return sanitizeAuditChanges(changes);
};
