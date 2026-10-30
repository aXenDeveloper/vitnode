import type { Context } from "hono";

import { and, eq, isNull, sql } from "drizzle-orm";

import type { ModeratorContext } from "@/api/lib/moderation/access";
import type { RegisteredReportTarget } from "@/api/lib/moderation/targets";
import type { WarningReason } from "@/api/lib/moderation/warnings/reasons";
import type { ContentDatabase } from "@/content/server/service";
import type {
  WarningContentSnapshot,
  WarningThresholdAction,
} from "@/lib/moderation/warnings";

import { userAuditLabel } from "@/api/lib/audit/labels";
import { isUniqueViolation } from "@/api/lib/db-errors";
import { canOnReport } from "@/api/lib/moderation/access";
import { findReportTarget } from "@/api/lib/moderation/registry";
import {
  canSeeWarning,
  canWarnForContent,
  hasWarningPermission,
  warningTargetRefusal,
} from "@/api/lib/moderation/warnings/access";
import { recordWarningAudit } from "@/api/lib/moderation/warnings/audit";
import { listWarningReasons } from "@/api/lib/moderation/warnings/reasons";
import { forgetSuspension } from "@/api/lib/moderation/warnings/suspension";
import {
  accountSuspendedNotification,
  suspensionRevokedNotification,
  warningIssuedNotification,
  warningRevokedNotification,
} from "@/api/lib/notifications/core-types";
import { core_users } from "@/database/users";
import {
  core_moderation_sanctions,
  core_moderation_warning_thresholds,
  core_moderation_warnings,
} from "@/database/warnings";
import { MODERATION_PERMISSIONS } from "@/lib/moderation/const";
import {
  activeWarningPoints,
  evaluateWarningThresholds,
  thresholdSuspensionEnd,
  WARNING_LIMITS,
  WARNING_PERMISSIONS,
} from "@/lib/moderation/warnings";

import type { ReportRow } from "./reports";

import {
  appendReportEvent,
  authorizeReport,
  reportConflict,
  reportError,
  updateReport,
} from "./reports";

const HOUR_MS = 60 * 60 * 1000;

export const warningError = reportError;

/** How the moderator wants the points to expire. */
export type WarningExpirationInput =
  | { at: Date; mode: "at" }
  | { hours: number; mode: "hours" }
  | { mode: "default" }
  | { mode: "never" };

export interface WarningContentInput {
  pluginId: string;
  targetId: string;
  targetType: string;
}

/** What preview and issue share: who, why, how many points, and what for. */
export interface WarningDraftInput {
  content?: null | WarningContentInput;
  expiration: WarningExpirationInput;
  points?: null | number;
  reasonId: null | number;
  reportId?: null | number;
  userId: number;
}

export interface IssueWarningInput extends WarningDraftInput {
  idempotencyKey: string;
  message: string;
  overrideNote?: null | string;
  resolveReport?: boolean;
  staffNote?: null | string;
}

export interface WarningTargetUser {
  id: number;
  name: string;
  roleId: number;
}

export interface ResolvedWarningContent {
  pluginId: string;
  scopeFamily: null | string;
  scopeId: null | string;
  snapshot: WarningContentSnapshot;
  target: RegisteredReportTarget;
  targetId: string;
  targetType: string;
}

/** A draft after every server-side check: what the warning would be. */
export interface ResolvedWarningDraft {
  content: null | ResolvedWarningContent;
  /** The reason's expiration in hours, `null` for never. */
  defaultExpiresAfterHours: null | number;
  defaultPoints: number;
  /** Computes the expiry against the time the warning is written. */
  expiresAt: (now: Date) => Date | null;
  overrides: { expiration: boolean; points: boolean };
  points: number;
  reason: null | WarningReason;
  report: null | ReportRow;
  user: WarningTargetUser;
}

const loadTargetUser = async (
  c: Context,
  userId: number,
): Promise<null | WarningTargetUser> => {
  const [user] = await c
    .get("db")
    .select({
      id: core_users.id,
      name: core_users.name,
      roleId: core_users.roleId,
    })
    .from(core_users)
    .where(eq(core_users.id, userId))
    .limit(1);

  return user ?? null;
};

const resolveContent = async (
  c: Context,
  moderator: ModeratorContext,
  content: WarningContentInput,
  userId: number,
): Promise<ResolvedWarningContent> => {
  const target = findReportTarget(c.get("core").moderation, {
    pluginId: content.pluginId,
    type: content.targetType,
  });
  const resolveAuthors = target?.definition.resolveAuthors;
  if (!target || !resolveAuthors) {
    throw warningError(404, { error: "content_not_found" });
  }
  const targetId = target.definition.parseId(content.targetId);
  if (targetId === null)
    throw warningError(404, { error: "content_not_found" });

  const { definition } = target;
  let scopeId: null | string = null;
  if (definition.scope && definition.resolveScope) {
    const resolved = await definition.resolveScope(c, targetId);
    if (resolved === undefined) {
      throw warningError(404, { error: "content_not_found" });
    }
    scopeId = resolved === "" ? null : resolved;
  }

  const ref = {
    pluginId: target.pluginId,
    scopeId,
    targetType: definition.type,
  };
  if (!canWarnForContent(c, moderator.set, ref)) {
    throw warningError(403, { error: "forbidden" });
  }

  const authors = await resolveAuthors(c, { targetId });
  if (!authors) throw warningError(404, { error: "content_not_found" });
  if (!authors.authorIds.includes(userId)) {
    throw warningError(400, { error: "author_mismatch" });
  }
  const current = await definition.current(c, { locale: null, targetId });

  return {
    pluginId: target.pluginId,
    scopeFamily: definition.scope ?? null,
    scopeId,
    snapshot: {
      title: authors.title ? authors.title.slice(0, 500) : null,
      url: current?.url ?? null,
    },
    target,
    targetId,
    targetType: definition.type,
  };
};

const sameContent = (
  a: WarningContentInput,
  b: Pick<ReportRow, "pluginId" | "targetId" | "targetType">,
): boolean =>
  a.pluginId === b.pluginId &&
  a.targetType === b.targetType &&
  a.targetId === b.targetId;

/**
 * Runs every check a warning needs - target protection, reason, scope,
 * authorship, report match, override permissions - and resolves what the
 * warning would hold. Never trusts a client-sent author or scope: both come
 * from the content's own report target.
 */
export const resolveWarningDraft = async (
  c: Context,
  moderator: ModeratorContext,
  input: WarningDraftInput,
): Promise<ResolvedWarningDraft> => {
  const user = await loadTargetUser(c, input.userId);
  if (!user) throw warningError(404, { error: "user_not_found" });

  const refusal = await warningTargetRefusal(c, moderator, user);
  if (refusal) throw warningError(403, { error: refusal });

  let report: null | ReportRow = null;
  let contentInput = input.content ?? null;
  if (input.reportId) {
    ({ report } = await authorizeReport(c, moderator, input.reportId));
    if (contentInput && !sameContent(contentInput, report)) {
      throw warningError(400, { error: "report_mismatch" });
    }
    contentInput = {
      pluginId: report.pluginId,
      targetId: report.targetId,
      targetType: report.targetType,
    };
  }

  const content = contentInput
    ? await resolveContent(c, moderator, contentInput, user.id)
    : null;
  if (
    !content &&
    !hasWarningPermission(moderator.set, WARNING_PERMISSIONS.warn)
  ) {
    throw warningError(403, { error: "forbidden" });
  }

  let reason: null | WarningReason = null;
  if (input.reasonId !== null) {
    [reason = null] = await listWarningReasons(c, { ids: [input.reasonId] });
    if (!reason) throw warningError(404, { error: "reason_not_found" });
    if (!reason.enabled) throw warningError(409, { error: "reason_disabled" });
  }

  const defaultPoints = reason?.points ?? 0;
  const defaultExpiresAfterHours = reason?.expiresAfterHours ?? null;
  const points = input.points ?? defaultPoints;
  if (
    !Number.isInteger(points) ||
    points < 0 ||
    points > WARNING_LIMITS.maxPoints
  ) {
    throw warningError(400, { error: "invalid_points" });
  }

  const { expiration } = input;
  const overrides = {
    expiration:
      expiration.mode === "at" ||
      (expiration.mode === "never" && defaultExpiresAfterHours !== null) ||
      (expiration.mode === "hours" &&
        expiration.hours !== defaultExpiresAfterHours),
    points: points !== defaultPoints,
  };
  if (
    overrides.points &&
    !hasWarningPermission(moderator.set, WARNING_PERMISSIONS.overridePoints)
  ) {
    throw warningError(403, { error: "points_override_forbidden" });
  }
  if (
    overrides.expiration &&
    !hasWarningPermission(moderator.set, WARNING_PERMISSIONS.overrideExpiration)
  ) {
    throw warningError(403, { error: "expiration_override_forbidden" });
  }

  const requestTime = Date.now();
  if (expiration.mode === "hours") {
    if (
      !Number.isInteger(expiration.hours) ||
      expiration.hours < 1 ||
      expiration.hours > WARNING_LIMITS.maxDurationHours
    ) {
      throw warningError(400, { error: "invalid_expiration" });
    }
  }
  if (expiration.mode === "at") {
    const at = expiration.at.getTime();
    if (
      Number.isNaN(at) ||
      at <= requestTime ||
      at > requestTime + WARNING_LIMITS.maxDurationHours * HOUR_MS
    ) {
      throw warningError(400, { error: "invalid_expiration" });
    }
  }

  const expiresAt = (now: Date): Date | null => {
    switch (expiration.mode) {
      case "at":
        return expiration.at;
      case "default":
        return defaultExpiresAfterHours === null
          ? null
          : new Date(now.getTime() + defaultExpiresAfterHours * HOUR_MS);
      case "hours":
        return new Date(now.getTime() + expiration.hours * HOUR_MS);
      case "never":
        return null;
    }
  };

  return {
    content,
    defaultExpiresAfterHours,
    defaultPoints,
    expiresAt,
    overrides,
    points,
    reason,
    report,
    user,
  };
};

type Db = ContentDatabase;

const lockUserWarnings = async (tx: Db, userId: number): Promise<void> => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`core_moderation_warnings:${userId}`}))`,
  );
};

/** The user's active points at `now`, read through `db`. */
export const loadActivePoints = async (
  db: Db,
  userId: number,
  now: Date,
): Promise<number> => {
  const rows = await db
    .select({
      expiresAt: core_moderation_warnings.expiresAt,
      points: core_moderation_warnings.points,
      revokedAt: core_moderation_warnings.revokedAt,
    })
    .from(core_moderation_warnings)
    .where(eq(core_moderation_warnings.userId, userId));

  return activeWarningPoints(rows, now);
};

export const loadEnabledThresholds = async (db: Db) =>
  await db
    .select({
      action: core_moderation_warning_thresholds.action,
      durationHours: core_moderation_warning_thresholds.durationHours,
      enabled: core_moderation_warning_thresholds.enabled,
      id: core_moderation_warning_thresholds.id,
      points: core_moderation_warning_thresholds.points,
    })
    .from(core_moderation_warning_thresholds)
    .where(eq(core_moderation_warning_thresholds.enabled, true));

export interface ProjectedSanction {
  action: WarningThresholdAction;
  durationHours: null | number;
  endsAt: Date | null;
  points: number;
  thresholdId: number;
}

/**
 * What a warning of `points` expiring at `expiresAt` would do to the user now.
 * Advisory: {@link issueWarning} computes it again under the user's lock.
 */
export const projectWarning = async (
  c: Context,
  {
    expiresAt,
    points,
    userId,
  }: { expiresAt: Date | null; points: number; userId: number },
) => {
  const db = c.get("db");
  const now = new Date();
  const [before, rules] = await Promise.all([
    loadActivePoints(db, userId, now),
    loadEnabledThresholds(db),
  ]);
  const counts = expiresAt === null || expiresAt.getTime() > now.getTime();
  const after = before + (counts ? points : 0);
  const { applied, crossed } = evaluateWarningThresholds({
    after,
    before,
    rules,
  });

  return {
    after,
    before,
    crossed: crossed.map(rule => rule.id),
    sanction: applied
      ? {
          action: applied.action,
          durationHours: applied.durationHours,
          endsAt: thresholdSuspensionEnd(applied, now),
          points: applied.points,
          thresholdId: applied.id,
        }
      : null,
  } satisfies {
    after: number;
    before: number;
    crossed: number[];
    sanction: null | ProjectedSanction;
  };
};

export interface IssuedWarning {
  duplicate: boolean;
  points: { after: number; before: number };
  reportResolved: boolean;
  sanction: null | {
    endsAt: Date | null;
    id: number;
    thresholdId: null | number;
  };
  warningId: number;
}

const findSanctionOfWarning = async (db: Db, warningId: number) => {
  const [sanction] = await db
    .select({
      endsAt: core_moderation_sanctions.endsAt,
      id: core_moderation_sanctions.id,
      thresholdId: core_moderation_sanctions.thresholdId,
    })
    .from(core_moderation_sanctions)
    .where(eq(core_moderation_sanctions.warningId, warningId))
    .limit(1);

  return sanction ?? null;
};

const findIssuedWarning = async (
  db: Db,
  moderator: ModeratorContext,
  {
    idempotencyKey,
    userId,
  }: Pick<IssueWarningInput, "idempotencyKey" | "userId">,
): Promise<IssuedWarning | null> => {
  const [existing] = await db
    .select({
      id: core_moderation_warnings.id,
      pointsAfter: core_moderation_warnings.pointsAfter,
      pointsBefore: core_moderation_warnings.pointsBefore,
      reportId: core_moderation_warnings.reportId,
      userId: core_moderation_warnings.userId,
    })
    .from(core_moderation_warnings)
    .where(
      and(
        eq(core_moderation_warnings.issuedById, moderator.user.id),
        eq(core_moderation_warnings.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  if (!existing) return null;
  if (existing.userId !== userId) {
    throw warningError(409, { error: "idempotency_conflict" });
  }

  return {
    duplicate: true,
    points: { after: existing.pointsAfter, before: existing.pointsBefore },
    reportResolved: false,
    sanction: await findSanctionOfWarning(db, existing.id),
    warningId: existing.id,
  };
};

/**
 * Issues a warning. Serialized per warned user with a transaction-scoped
 * advisory lock, so concurrent warnings read each other's points and a
 * threshold creates at most one sanction. The warning, the threshold decision,
 * the sanction, the audit entries, the optional report resolution and the
 * notifications commit together or not at all. A retry with the same
 * `idempotencyKey` from the same moderator returns the first result.
 */
export const issueWarning = async (
  c: Context,
  moderator: ModeratorContext,
  input: IssueWarningInput,
): Promise<IssuedWarning> => {
  // A retry of a request that already went through answers with its result,
  // even when the report it resolved is closed or the content is gone now.
  const previous = await findIssuedWarning(c.get("db"), moderator, input);
  if (previous) return previous;

  const draft = await resolveWarningDraft(c, moderator, input);
  const overridden = draft.overrides.points || draft.overrides.expiration;
  const overrideNote = input.overrideNote?.trim() ?? "";
  const staffNote = input.staffNote?.trim() ?? "";
  if (overridden && overrideNote.length < WARNING_LIMITS.explanationMinLength) {
    throw warningError(400, { error: "override_note_required" });
  }

  const { report } = draft;
  const resolveReport = Boolean(report && input.resolveReport);
  if (report && resolveReport) {
    const manage = canOnReport(
      c,
      moderator.set,
      {
        pluginId: report.pluginId,
        scopeId: report.scopeId,
        targetType: report.targetType,
      },
      MODERATION_PERMISSIONS.manageReports,
    );
    if (!manage) throw warningError(403, { error: "forbidden" });
    if (report.status === "done") throw reportConflict(report, "report_closed");
  }

  const issue = async () =>
    await c.get("db").transaction(async (tx: Db) => {
      await lockUserWarnings(tx, draft.user.id);

      const existing = await findIssuedWarning(tx, moderator, input);
      if (existing) return existing;

      const now = new Date();
      const expiresAt = draft.expiresAt(now);
      const before = await loadActivePoints(tx, draft.user.id, now);
      const counts = expiresAt === null || expiresAt.getTime() > now.getTime();
      const after = before + (counts ? draft.points : 0);

      const [warning] = await tx
        .insert(core_moderation_warnings)
        .values({
          contentSnapshot: draft.content?.snapshot ?? null,
          defaultPoints: draft.defaultPoints,
          expiresAt,
          idempotencyKey: input.idempotencyKey,
          issuedAt: now,
          issuedById: moderator.user.id,
          message: input.message.trim(),
          overrideNote: overridden ? overrideNote : null,
          pluginId: draft.content?.pluginId ?? null,
          points: draft.points,
          pointsAfter: after,
          pointsBefore: before,
          reasonId: draft.reason?.id ?? null,
          reasonSnapshot: draft.reason ? { title: draft.reason.title } : null,
          reportId: report?.id ?? null,
          scopeFamily: draft.content?.scopeFamily ?? null,
          scopeId: draft.content?.scopeId ?? null,
          staffNote: staffNote === "" ? null : staffNote,
          targetId: draft.content?.targetId ?? null,
          targetType: draft.content?.targetType ?? null,
          userId: draft.user.id,
        })
        .returning({ id: core_moderation_warnings.id });

      const rules = await loadEnabledThresholds(tx);
      const { applied, crossed } = evaluateWarningThresholds({
        after,
        before,
        rules,
      });
      const scope =
        draft.content?.scopeFamily && draft.content.scopeId
          ? { family: draft.content.scopeFamily, id: draft.content.scopeId }
          : null;
      await recordWarningAudit(c, tx, {
        action: "warning.issued",
        metadata: {
          appliedThresholdId: applied?.id ?? null,
          contentId: draft.content?.targetId ?? null,
          contentPluginId: draft.content?.pluginId ?? null,
          contentType: draft.content?.targetType ?? null,
          crossedThresholdIds: crossed.map(rule => rule.id),
          defaultExpiresAfterHours: draft.defaultExpiresAfterHours,
          defaultPoints: draft.defaultPoints,
          expirationOverridden: draft.overrides.expiration,
          expiresAt: expiresAt?.toISOString() ?? null,
          points: draft.points,
          pointsAfter: after,
          pointsBefore: before,
          pointsOverridden: draft.overrides.points,
          reasonId: draft.reason?.id ?? null,
          reportId: report?.id ?? null,
          warningId: warning.id,
        },
        scope,
        user: draft.user,
      });

      let sanction: IssuedWarning["sanction"] = null;
      if (applied) {
        const endsAt = thresholdSuspensionEnd(applied, now);
        const [row] = await tx
          .insert(core_moderation_sanctions)
          .values({
            createdById: moderator.user.id,
            endsAt,
            source: "threshold",
            startsAt: now,
            thresholdId: applied.id,
            thresholdSnapshot: {
              action: applied.action,
              durationHours: applied.durationHours,
              points: applied.points,
            },
            type: "suspension",
            userId: draft.user.id,
            warningId: warning.id,
          })
          .returning({ id: core_moderation_sanctions.id });
        sanction = { endsAt, id: row.id, thresholdId: applied.id };
        await recordWarningAudit(c, tx, {
          action: "sanction.applied",
          metadata: {
            endsAt: endsAt?.toISOString() ?? null,
            sanctionId: row.id,
            source: "threshold",
            thresholdAction: applied.action,
            thresholdId: applied.id,
            thresholdPoints: applied.points,
            warningId: warning.id,
          },
          scope,
          user: draft.user,
        });
      }

      if (report) {
        await appendReportEvent(tx, {
          actorId: moderator.user.id,
          data: {
            points: draft.points,
            userId: draft.user.id,
            warningId: warning.id,
          },
          reportId: report.id,
          type: "warning",
        });
        if (resolveReport) {
          await updateReport(tx, report, {
            openKey: null,
            resolution: "action_taken",
            resolvedAt: now,
            resolvedById: moderator.user.id,
            status: "done",
          });
          await appendReportEvent(tx, {
            actorId: moderator.user.id,
            data: { resolution: "action_taken", warningId: warning.id },
            reportId: report.id,
            type: "resolved",
          });
        }
      }

      const notifications = c.get("notifications");
      await notifications.publish({
        actorId: null,
        data: {
          message: input.message.trim(),
          points: draft.points,
          reason: draft.reason?.title ?? null,
          warningId: warning.id,
        },
        idempotencyKey: `warning:${warning.id}`,
        recipients: [draft.user.id],
        tx,
        type: warningIssuedNotification,
      });
      if (sanction) {
        await notifications.publish({
          actorId: null,
          data: {
            endsAt: sanction.endsAt?.toISOString() ?? null,
            sanctionId: sanction.id,
          },
          idempotencyKey: `sanction:${sanction.id}`,
          recipients: [draft.user.id],
          tx,
          type: accountSuspendedNotification,
        });
      }

      return {
        duplicate: false,
        points: { after, before },
        reportResolved: resolveReport,
        sanction,
        warningId: warning.id,
      } satisfies IssuedWarning;
    });

  // The lock is per warned member, so the same key sent at once for two
  // members only meets at the unique (issuedById, idempotencyKey) index.
  const result = await issue().catch(async (error: unknown) => {
    if (!isUniqueViolation(error)) throw error;
    const existing = await findIssuedWarning(c.get("db"), moderator, input);
    if (!existing) throw error;

    return existing;
  });

  if (result.duplicate) return result;

  if (result.sanction) {
    await forgetSuspension(c, draft.user.id, { disconnect: true });
  }
  const events = c.get("events");
  await events.emit("moderation.warning.issued", {
    issuedById: moderator.user.id,
    pluginId: draft.content?.pluginId ?? null,
    points: draft.points,
    reasonId: draft.reason?.id ?? null,
    reportId: report?.id ?? null,
    targetId: draft.content?.targetId ?? null,
    targetType: draft.content?.targetType ?? null,
    userId: draft.user.id,
    warningId: result.warningId,
  });
  if (result.sanction) {
    await events.emit("moderation.sanction.applied", {
      endsAt: result.sanction.endsAt,
      sanctionId: result.sanction.id,
      source: "threshold",
      thresholdId: result.sanction.thresholdId,
      type: "suspension",
      userId: draft.user.id,
      warningId: result.warningId,
    });
  }
  if (report && result.reportResolved) {
    await events.emit("moderation.report.resolved", {
      reportId: report.id,
      resolution: "action_taken",
    });
  }

  return result;
};

/**
 * Revokes a warning: its points stop counting at once, the record stays.
 * Sanctions it led to stay too - lifting them is a separate action.
 */
export const revokeWarning = async (
  c: Context,
  moderator: ModeratorContext,
  { id, reason }: { id: number; reason: string },
) => {
  const db = c.get("db");
  const [warning] = await db
    .select()
    .from(core_moderation_warnings)
    .where(eq(core_moderation_warnings.id, id))
    .limit(1);
  if (!warning || !canSeeWarning(c, moderator, warning)) {
    throw warningError(404, { error: "not_found" });
  }
  if (!hasWarningPermission(moderator.set, WARNING_PERMISSIONS.revoke)) {
    throw warningError(403, { error: "forbidden" });
  }
  if (warning.revokedAt) throw warningError(409, { error: "already_revoked" });

  const revoked = await db.transaction(async (tx: Db) => {
    const now = new Date();
    const [row] = await tx
      .update(core_moderation_warnings)
      .set({
        revokedAt: now,
        revokedById: moderator.user.id,
        revokeReason: reason.trim(),
      })
      .where(
        and(
          eq(core_moderation_warnings.id, id),
          isNull(core_moderation_warnings.revokedAt),
        ),
      )
      .returning({ id: core_moderation_warnings.id });
    if (!row) return false;

    await recordWarningAudit(c, tx, {
      action: "warning.revoked",
      metadata: { points: warning.points, warningId: id },
      scope:
        warning.scopeFamily && warning.scopeId
          ? { family: warning.scopeFamily, id: warning.scopeId }
          : null,
      user: {
        id: warning.userId,
        name: await userAuditLabel(c, warning.userId),
      },
    });
    await c.get("notifications").publish({
      actorId: null,
      data: {
        points: warning.points,
        reason: warning.reasonSnapshot?.title ?? null,
        warningId: id,
      },
      idempotencyKey: `warning-revoked:${id}`,
      recipients: [warning.userId],
      tx,
      type: warningRevokedNotification,
    });

    return true;
  });
  if (!revoked) throw warningError(409, { error: "already_revoked" });

  await c.get("events").emit("moderation.warning.revoked", {
    revokedById: moderator.user.id,
    userId: warning.userId,
    warningId: id,
  });

  return { userId: warning.userId, warningId: id };
};

/**
 * Lifts one sanction. Other active sanctions of the same user keep applying.
 */
export const revokeSanction = async (
  c: Context,
  moderator: ModeratorContext,
  { id, reason }: { id: number; reason: string },
) => {
  if (
    !hasWarningPermission(moderator.set, WARNING_PERMISSIONS.manageSanctions)
  ) {
    throw warningError(403, { error: "forbidden" });
  }
  const db = c.get("db");
  const [sanction] = await db
    .select()
    .from(core_moderation_sanctions)
    .where(eq(core_moderation_sanctions.id, id))
    .limit(1);
  if (!sanction) throw warningError(404, { error: "not_found" });
  if (sanction.revokedAt) throw warningError(409, { error: "already_revoked" });

  const revoked = await db.transaction(async (tx: Db) => {
    const [row] = await tx
      .update(core_moderation_sanctions)
      .set({
        revokedAt: new Date(),
        revokedById: moderator.user.id,
        revokeReason: reason.trim(),
      })
      .where(
        and(
          eq(core_moderation_sanctions.id, id),
          isNull(core_moderation_sanctions.revokedAt),
        ),
      )
      .returning({ id: core_moderation_sanctions.id });
    if (!row) return false;

    await recordWarningAudit(c, tx, {
      action: "sanction.revoked",
      metadata: {
        sanctionId: id,
        type: sanction.type,
        warningId: sanction.warningId,
      },
      user: {
        id: sanction.userId,
        name: await userAuditLabel(c, sanction.userId),
      },
    });
    await c.get("notifications").publish({
      actorId: null,
      data: { sanctionId: id },
      idempotencyKey: `sanction-revoked:${id}`,
      recipients: [sanction.userId],
      tx,
      type: suspensionRevokedNotification,
    });

    return true;
  });
  if (!revoked) throw warningError(409, { error: "already_revoked" });

  await forgetSuspension(c, sanction.userId, { disconnect: false });
  await c.get("events").emit("moderation.sanction.revoked", {
    revokedById: moderator.user.id,
    sanctionId: id,
    userId: sanction.userId,
  });

  return { sanctionId: id, userId: sanction.userId };
};
