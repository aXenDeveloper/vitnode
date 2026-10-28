import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { desc, eq, inArray } from "drizzle-orm";

import type { ModeratorContext } from "@/api/lib/moderation/access";

import { findReportTarget } from "@/api/lib/moderation/registry";
import {
  canSeeWarning,
  canSeeWarningNotes,
  hasWarningPermission,
} from "@/api/lib/moderation/warnings/access";
import {
  core_moderation_sanctions,
  core_moderation_warnings,
} from "@/database/warnings";
import {
  isSanctionActiveAt,
  SANCTION_SOURCES,
  SANCTION_TYPES,
  WARNING_PERMISSIONS,
  WARNING_STATUSES,
  WARNING_THRESHOLD_ACTIONS,
  warningStatusAt,
} from "@/lib/moderation/warnings";

import { loadReportPeople } from "./people";
import { reportPersonSchema } from "./schema";

const textSchema = z.array(
  z.object({ languageCode: z.string(), value: z.string() }),
);

export const warningContentSchema = z.object({
  pluginId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  targetLabel: z.string().nullable(),
  title: z.string().nullable(),
  url: z.string().nullable(),
});

/** A warning as staff see it; notes are `null` without `can_view_notes`. */
export const staffWarningSchema = z.object({
  id: z.number(),
  userId: z.number(),
  status: z.enum(WARNING_STATUSES),
  points: z.number(),
  defaultPoints: z.number().nullable(),
  reasonId: z.number().nullable(),
  reason: textSchema.nullable(),
  message: z.string(),
  staffNote: z.string().nullable(),
  overrideNote: z.string().nullable(),
  issuedAt: z.date(),
  expiresAt: z.date().nullable(),
  issuedBy: reportPersonSchema.nullable(),
  content: warningContentSchema.nullable(),
  reportId: z.number().nullable(),
  revokedAt: z.date().nullable(),
  revokedBy: reportPersonSchema.nullable(),
  revokeReason: z.string().nullable(),
  sanctionId: z.number().nullable(),
});

export const sanctionSchema = z.object({
  id: z.number(),
  type: z.enum(SANCTION_TYPES),
  source: z.enum(SANCTION_SOURCES),
  active: z.boolean(),
  startsAt: z.date(),
  endsAt: z.date().nullable(),
  warningId: z.number().nullable(),
  threshold: z
    .object({
      action: z.enum(WARNING_THRESHOLD_ACTIONS),
      durationHours: z.number().nullable(),
      points: z.number(),
    })
    .nullable(),
  createdBy: reportPersonSchema.nullable(),
  revokedAt: z.date().nullable(),
  revokedBy: reportPersonSchema.nullable(),
  revokeReason: z.string().nullable(),
});

export type WarningRow = typeof core_moderation_warnings.$inferSelect;
export type SanctionRow = typeof core_moderation_sanctions.$inferSelect;

const contentOf = (c: Context, row: WarningRow) => {
  if (!row.pluginId || !row.targetType || !row.targetId) return null;

  return {
    pluginId: row.pluginId,
    targetType: row.targetType,
    targetId: row.targetId,
    targetLabel:
      findReportTarget(c.get("core").moderation, {
        pluginId: row.pluginId,
        type: row.targetType,
      })?.definition.label ?? null,
    title: row.contentSnapshot?.title ?? null,
    url: row.contentSnapshot?.url ?? null,
  };
};

/**
 * Turns warning rows into what one moderator may read: rows they may not
 * see are dropped, and staff notes are blanked unless allowed.
 */
export const serializeStaffWarnings = async (
  c: Context,
  moderator: ModeratorContext,
  rows: WarningRow[],
  now: Date = new Date(),
) => {
  const visible = rows.filter(row => canSeeWarning(c, moderator, row));
  const canViewSanctions = hasWarningPermission(
    moderator.set,
    WARNING_PERMISSIONS.viewSanctions,
  );
  const [people, sanctions] = await Promise.all([
    loadReportPeople(
      c,
      visible.flatMap(row => [row.issuedById, row.revokedById]),
    ),
    canViewSanctions && visible.length > 0
      ? c
          .get("db")
          .select({
            id: core_moderation_sanctions.id,
            warningId: core_moderation_sanctions.warningId,
          })
          .from(core_moderation_sanctions)
          .where(
            inArray(
              core_moderation_sanctions.warningId,
              visible.map(row => row.id),
            ),
          )
      : [],
  ]);
  const person = (id: null | number) =>
    id === null ? null : (people.get(id) ?? null);

  return visible.map(row => {
    const notes = canSeeWarningNotes(moderator, row);

    return {
      id: row.id,
      userId: row.userId,
      status: warningStatusAt(row, now),
      points: row.points,
      defaultPoints: row.defaultPoints,
      reasonId: row.reasonId,
      reason: row.reasonSnapshot?.title ?? null,
      message: row.message,
      staffNote: notes ? row.staffNote : null,
      overrideNote: notes ? row.overrideNote : null,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      issuedBy: person(row.issuedById),
      content: contentOf(c, row),
      reportId: row.reportId,
      revokedAt: row.revokedAt,
      revokedBy: person(row.revokedById),
      revokeReason: row.revokeReason,
      sanctionId:
        sanctions.find(sanction => sanction.warningId === row.id)?.id ?? null,
    };
  });
};

export const serializeSanctions = async (
  c: Context,
  rows: SanctionRow[],
  now: Date = new Date(),
) => {
  const people = await loadReportPeople(
    c,
    rows.flatMap(row => [row.createdById, row.revokedById]),
  );
  const person = (id: null | number) =>
    id === null ? null : (people.get(id) ?? null);

  return rows.map(row => ({
    id: row.id,
    type: row.type,
    source: row.source,
    active: isSanctionActiveAt(row, now),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    warningId: row.warningId,
    threshold: row.thresholdSnapshot,
    createdBy: person(row.createdById),
    revokedAt: row.revokedAt,
    revokedBy: person(row.revokedById),
    revokeReason: row.revokeReason,
  }));
};

export const loadUserWarnings = async (c: Context, userId: number) =>
  await c
    .get("db")
    .select()
    .from(core_moderation_warnings)
    .where(eq(core_moderation_warnings.userId, userId))
    .orderBy(
      desc(core_moderation_warnings.issuedAt),
      desc(core_moderation_warnings.id),
    );

export const loadUserSanctions = async (c: Context, userId: number) =>
  await c
    .get("db")
    .select()
    .from(core_moderation_sanctions)
    .where(eq(core_moderation_sanctions.userId, userId))
    .orderBy(
      desc(core_moderation_sanctions.startsAt),
      desc(core_moderation_sanctions.id),
    );
