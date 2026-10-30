import type { Context } from "hono";

import { randomUUID } from "node:crypto";

import type {
  AuditActorType,
  AuditArea,
  AuditChanges,
} from "@/lib/audit/const";

/** Who an audit entry is attributed to. `userId` is `null` for the system. */
export interface AuditActor {
  type: AuditActorType;
  userId: null | number;
}

/** The system itself: a scheduled task, a queue job, a cron run. */
export const AUDIT_SYSTEM_ACTOR: AuditActor = { type: "system", userId: null };

/**
 * One audit entry as it travels through {@link AuditContextFrame.intercept},
 * before it is sanitized and written.
 */
export interface AuditPendingEntry {
  action: string;
  actor: AuditActor;
  area: AuditArea;
  changes: AuditChanges | null;
  contentTypeId: null | string;
  metadata: Record<string, unknown>;
  pluginId: string;
  revisionId: null | number;
  scope: null | { family: string; id: string };
  target: { id: null | string; label: null | string; type: string };
}

/**
 * Trusted context layered over a block of server code with
 * {@link withAuditContext}. Never built from request input.
 */
export interface AuditContextFrame {
  /**
   * Attributes every entry in the block to this actor instead of the request's
   * user - `AUDIT_SYSTEM_ACTOR` for background work.
   */
  actor?: AuditActor;
  area?: AuditArea;
  /** Groups the block's entries. Defaults to one id per request. */
  correlationId?: string;
  /**
   * Sees each entry written inside the block, before it is stored, and returns
   * the entry to write - changed or not - or `null` to drop it because the
   * caller records the operation as a whole. Runs inside the same transaction.
   */
  intercept?: (entry: AuditPendingEntry) => AuditPendingEntry | null;
  /** Merged into every entry's metadata; the entry's own keys win. */
  metadata?: Record<string, unknown>;
  /**
   * The moderation scope of every entry in the block that names none - a
   * report action hiding a forum post belongs to the forum's scope.
   */
  scope?: null | { family: string; id: string };
}

const frames = new WeakMap<Context, AuditContextFrame[]>();
const correlationIds = new WeakMap<Context, string>();

/**
 * Runs `body` with `frame` applied to every audit entry it writes on `c` -
 * the trusted way to attribute background work to the system, to say which
 * schedule triggered a publish, or to fold nested writes into one entry.
 * Frames nest; the innermost one is applied first. Server-only.
 *
 * @example
 * ```ts
 * import { AUDIT_SYSTEM_ACTOR, withAuditContext } from "@vitnode/core/api/lib/audit/context";
 *
 * await withAuditContext(
 *   c,
 *   { actor: AUDIT_SYSTEM_ACTOR, area: "system", metadata: { trigger: "import" } },
 *   async () => await importProducts(c),
 * );
 * ```
 */
export const withAuditContext = async <TResult>(
  c: Context,
  frame: AuditContextFrame,
  body: () => Promise<TResult>,
): Promise<TResult> => {
  const stack = frames.get(c) ?? [];
  stack.push(frame);
  frames.set(c, stack);

  try {
    return await body();
  } finally {
    const index = stack.lastIndexOf(frame);
    if (index !== -1) stack.splice(index, 1);
  }
};

/** The frames active on `c`, innermost first. */
export const auditContextFrames = (c: Context): AuditContextFrame[] =>
  [...(frames.get(c) ?? [])].reverse();

/** The id every entry written for this request (or background run) shares. */
export const auditCorrelationId = (c: Context): string => {
  for (const frame of auditContextFrames(c)) {
    if (frame.correlationId) return frame.correlationId;
  }

  const existing = correlationIds.get(c);
  if (existing) return existing;

  const id = randomUUID();
  correlationIds.set(c, id);

  return id;
};
