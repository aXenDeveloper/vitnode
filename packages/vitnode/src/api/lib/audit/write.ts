import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type {
  AuditArea,
  AuditChanges,
  AuditScope,
  AuditTarget,
} from "@/lib/audit/const";

import { core_audit_logs } from "@/database/audit";
import { core_users } from "@/database/users";
import {
  AUDIT_ACTION_MAX_LENGTH,
  AUDIT_ACTION_PATTERN,
  AUDIT_AREAS,
  AUDIT_CORE_PLUGIN_ID,
  AUDIT_PLUGIN_ID_MAX_LENGTH,
  AUDIT_SCOPE_FAMILY_MAX_LENGTH,
  AUDIT_SCOPE_ID_MAX_LENGTH,
  AUDIT_TARGET_ID_MAX_LENGTH,
  AUDIT_TARGET_LABEL_MAX_LENGTH,
  AUDIT_TARGET_TYPE_MAX_LENGTH,
  AUDIT_TARGET_TYPE_PATTERN,
} from "@/lib/audit/const";
import {
  sanitizeAuditChanges,
  sanitizeAuditMetadata,
} from "@/lib/audit/sanitize";

import type { AuditActor, AuditPendingEntry } from "./context";

import {
  AUDIT_SYSTEM_ACTOR,
  auditContextFrames,
  auditCorrelationId,
} from "./context";

/** A database handle or an open transaction to write the entry with. */
export type AuditDatabase = Omit<Context["var"]["db"], "$client">;

/** An audit entry that cannot be stored as written - a bug in the caller. */
export class AuditLogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditLogError";
  }
}

/** Everything one entry can carry, before context is applied. */
export interface AuditWriteInput {
  action: string;
  /** Trusted server-side attribution. Omitted, the request decides. */
  actor?: AuditActor;
  area?: AuditArea;
  changes?: AuditChanges | null;
  contentTypeId?: null | string;
  metadata?: Record<string, unknown>;
  pluginId?: string;
  revisionId?: null | number;
  scope?: AuditScope | null;
  target: AuditTarget;
}

const cut = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

/**
 * Who the request is acting as: the AdminCP admin as staff, a signed-in user
 * as staff in the ModeratorCP or as `api` elsewhere, and nobody as the system.
 * Only the session decides - never a value from the request body.
 */
export const resolveAuditActor = (c: Context, area: AuditArea): AuditActor => {
  const adminId = c.get("admin")?.user.id;
  if (typeof adminId === "number") return { type: "staff", userId: adminId };

  const userId = c.get("user")?.id;
  if (typeof userId === "number") {
    return { type: area === "moderator" ? "staff" : "api", userId };
  }

  return AUDIT_SYSTEM_ACTOR;
};

/** The area a request writes from when nobody says otherwise. */
export const resolveAuditArea = (c: Context): AuditArea => {
  if (c.get("admin")) return "admin";
  if (c.get("user")) return "public";

  return "system";
};

const actorName = async (
  c: Context,
  db: AuditDatabase,
  actor: AuditActor,
): Promise<null | string> => {
  if (actor.userId === null) return null;
  const admin = c.get("admin")?.user;
  if (admin?.id === actor.userId) return admin.name;
  const user = c.get("user");
  if (user?.id === actor.userId) return user.name;

  const [row] = await db
    .select({ name: core_users.name })
    .from(core_users)
    .where(eq(core_users.id, actor.userId))
    .limit(1);

  return row?.name ?? null;
};

const validate = (entry: AuditPendingEntry): void => {
  if (
    entry.action.length > AUDIT_ACTION_MAX_LENGTH ||
    !AUDIT_ACTION_PATTERN.test(entry.action)
  ) {
    throw new AuditLogError(
      `Audit action "${entry.action}" must be lowercase words joined by dots, like "category.updated".`,
    );
  }
  if (
    entry.target.type.length > AUDIT_TARGET_TYPE_MAX_LENGTH ||
    !AUDIT_TARGET_TYPE_PATTERN.test(entry.target.type)
  ) {
    throw new AuditLogError(
      `Audit target type "${entry.target.type}" must be a short lowercase identifier, like "category".`,
    );
  }
  if (
    entry.pluginId === "" ||
    entry.pluginId.length > AUDIT_PLUGIN_ID_MAX_LENGTH
  ) {
    throw new AuditLogError(
      "An audit entry needs the id of the plugin it belongs to.",
    );
  }
  if (!(AUDIT_AREAS as readonly string[]).includes(entry.area)) {
    throw new AuditLogError(`Unknown audit area "${entry.area}".`);
  }
};

/**
 * Resolves context, applies the active {@link withAuditContext} frames,
 * sanitizes and writes one entry. Inside `tx` the entry commits or rolls back
 * with the caller's change; a failed insert throws, so a critical operation
 * cannot commit without its entry.
 *
 * Internal to core: plugins call `c.get("audit").record()`.
 *
 * @returns The new entry's id, or `null` when a frame dropped it.
 */
export const writeAuditLog = async (
  c: Context,
  input: AuditWriteInput,
  tx?: AuditDatabase,
): Promise<null | number> => {
  const db = tx ?? c.get("db");
  const frames = auditContextFrames(c);
  const framed = <TKey extends "actor" | "area">(key: TKey) =>
    frames.find(frame => frame[key] !== undefined)?.[key];

  const area = input.area ?? framed("area") ?? resolveAuditArea(c);
  const resolved = input.actor ?? framed("actor") ?? resolveAuditActor(c, area);
  // A member acting from a moderator tool is acting as staff, whatever the
  // write path called them.
  const actor: AuditActor =
    area === "moderator" && resolved.type === "api"
      ? { ...resolved, type: "staff" }
      : resolved;
  const frameMetadata = Object.assign(
    {},
    ...[...frames].reverse().map(frame => frame.metadata ?? {}),
  ) as Record<string, unknown>;

  let entry: AuditPendingEntry | null = {
    action: input.action,
    actor,
    area,
    changes: input.changes ?? null,
    contentTypeId: input.contentTypeId ?? null,
    metadata: { ...frameMetadata, ...input.metadata },
    pluginId: input.pluginId ?? c.get("plugin")?.id ?? AUDIT_CORE_PLUGIN_ID,
    revisionId: input.revisionId ?? null,
    scope: input.scope
      ? { family: input.scope.family, id: String(input.scope.id) }
      : (frames.find(frame => frame.scope)?.scope ?? null),
    target: {
      id:
        input.target.id === undefined || input.target.id === null
          ? null
          : String(input.target.id),
      label: input.target.label ?? null,
      type: input.target.type,
    },
  };

  for (const frame of frames) {
    if (!frame.intercept) continue;
    entry = frame.intercept(entry);
    if (!entry) return null;
  }

  validate(entry);

  const [row] = await db
    .insert(core_audit_logs)
    .values({
      action: entry.action,
      actorId: entry.actor.userId,
      actorName: await actorName(c, db, entry.actor),
      actorType: entry.actor.type,
      area: entry.area,
      changes: sanitizeAuditChanges(entry.changes),
      contentTypeId: entry.contentTypeId,
      correlationId: auditCorrelationId(c),
      // The address of whoever acted. A system entry has nobody behind it, and
      // the address of the cron caller would only be noise with a privacy cost.
      ipAddress:
        entry.actor.type === "system" ? null : (c.get("ipAddress") ?? null),
      metadata: sanitizeAuditMetadata(entry.metadata),
      pluginId: entry.pluginId,
      revisionId: entry.revisionId,
      scopeFamily: entry.scope
        ? cut(entry.scope.family, AUDIT_SCOPE_FAMILY_MAX_LENGTH)
        : null,
      scopeId: entry.scope
        ? cut(entry.scope.id, AUDIT_SCOPE_ID_MAX_LENGTH)
        : null,
      targetId:
        entry.target.id === null
          ? null
          : cut(entry.target.id, AUDIT_TARGET_ID_MAX_LENGTH),
      targetLabel:
        entry.target.label === null
          ? null
          : cut(entry.target.label, AUDIT_TARGET_LABEL_MAX_LENGTH),
      targetType: entry.target.type,
    })
    .returning({ id: core_audit_logs.id });

  return row?.id ?? null;
};

/**
 * {@link writeAuditLog} for an operation that has already happened outside a
 * transaction this code owns (sessions revoked through another model, a
 * setting saved by a helper): a failed write is reported to the technical log
 * - without the payload - instead of failing a request whose change stands.
 */
export const writeAuditLogBestEffort = async (
  c: Context,
  input: AuditWriteInput,
): Promise<null | number> => {
  try {
    return await writeAuditLog(c, input);
  } catch (error) {
    if (error instanceof AuditLogError) throw error;
    try {
      await c
        .get("log")
        ?.error(
          `[audit] Could not record "${input.action}" on ${input.target.type}: ${
            error instanceof Error ? error.name : "unknown error"
          }`,
        );
    } catch {
      // The logger writes to the same database; nothing more to do.
    }

    return null;
  }
};
