import type { Context } from "hono";

import type {
  AuditArea,
  AuditChanges,
  AuditScope,
  AuditTarget,
} from "@/lib/audit/const";
import type { AuditDiffArgs } from "@/lib/audit/diff";

import { auditDiff } from "@/lib/audit/diff";

import type { AuditDatabase } from "../lib/audit/write";

import { writeAuditLog, writeAuditLogBestEffort } from "../lib/audit/write";

/** One operation to record with `c.get("audit").record()`. */
export interface AuditRecordInput {
  /**
   * A stable identifier, lowercase words joined by dots, unique within the
   * plugin: `topic.moved`, `category.updated`. It is stored as-is and is what
   * the UI translates, so never rename one that has shipped.
   */
  action: string;
  /**
   * Where the operation was performed. Defaults to `admin` on an AdminCP
   * request, `public` for a signed-in user and `system` otherwise - pass
   * `moderator` from moderation tools, which files the entry in the
   * moderators' log instead of the admins'.
   */
  area?: AuditArea;
  /** Before/after values, usually from `c.get("audit").diff()`. Sensitive fields are always redacted. */
  changes?: AuditChanges | null;
  /**
   * Small, non-personal facts worth keeping (`{ fromForumId: 3 }`). Sanitized
   * and size-capped; never pass request bodies, errors or secrets.
   */
  metadata?: Record<string, unknown>;
  /** Defaults to the plugin of the route handling the request. */
  pluginId?: string;
  /**
   * The moderation scope the target lives in, as the moderation registry
   * names it (`{ family: "forum", id: 4 }`).
   */
  scope?: AuditScope | null;
  target: AuditTarget;
}

export interface AuditRecordOptions {
  /**
   * Log a failed write to the technical log instead of throwing. Only for
   * operations that are not security-relevant; never with `tx`.
   */
  bestEffort?: boolean;
  /**
   * The transaction of the change being recorded. The entry then commits and
   * rolls back with it, and a failed write fails the change - use it for
   * anything security-relevant.
   */
  tx?: AuditDatabase;
}

/**
 * `c.get("audit")`: records who did what, when and to which resource in the
 * central audit log shown in AdminCP -> Staff -> Administrators / Moderators -> Logs.
 * Server-only.
 *
 * The actor, IP address and correlation id always come from the request (or
 * from a trusted `withAuditContext` frame for background work), never from the
 * input. Content Engine writes are recorded automatically - call this for
 * your plugin's own operations.
 *
 * @example
 * ```ts
 * const note = await c.get("db").transaction(async tx => {
 *   const [created] = await tx.insert(site_notes).values(values).returning();
 *
 *   await c.get("audit").record(
 *     {
 *       action: "note.created",
 *       target: { type: "note", id: created.id, label: created.title },
 *       changes: c.get("audit").diff({
 *         before: null,
 *         after: created,
 *         include: ["title", "body"],
 *       }),
 *     },
 *     { tx },
 *   );
 *
 *   return created;
 * });
 * ```
 */
export class AuditModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  /**
   * Structured before/after changes between two objects - see `auditDiff`
   * in `@vitnode/core/lib/audit/diff`.
   */
  diff<TField extends string>(
    args: AuditDiffArgs<TField>,
  ): AuditChanges | null {
    return auditDiff(args);
  }

  /**
   * Writes one entry.
   *
   * @returns The entry's id, or `null` when it was folded into an enclosing
   * operation, or when a best-effort write failed.
   * @throws `AuditLogError` when the input is malformed (an invalid action or
   * target type) - a bug, so it is never swallowed. Database errors are thrown
   * too unless `bestEffort` is set.
   */
  async record(
    input: AuditRecordInput,
    { bestEffort = false, tx }: AuditRecordOptions = {},
  ): Promise<null | number> {
    if (!bestEffort || tx) return await writeAuditLog(this.c, input, tx);

    return await writeAuditLogBestEffort(this.c, input);
  }
}
