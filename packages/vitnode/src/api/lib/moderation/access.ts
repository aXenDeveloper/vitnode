import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { and, eq, inArray, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import {
  core_moderation_report_events,
  core_moderation_reports,
} from "@/database/moderation";
import { core_users } from "@/database/users";
import { MODERATION_PERMISSIONS } from "@/lib/moderation/const";

import type { ResolvedStaffPermissionSet } from "../permission-staff";
import type { RegisteredReportTarget } from "./targets";

import { resolveStaffPermissions } from "../check-staff-permission";
import {
  hasStaffPermission,
  staffPermissionResources,
} from "../staff-permission";
import { findReportTarget } from "./registry";

export interface ModeratorContext {
  set: ResolvedStaffPermissionSet;
  user: { id: number; roleId: number };
}

export const requireModerator = async (
  c: Context,
): Promise<ModeratorContext> => {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "Sign in first." });

  const set = await resolveStaffPermissions(c, { type: "moderator", user });
  if (!set.staff) throw new HTTPException(403, { message: "Forbidden" });

  return { set, user };
};

export interface ReportScopeRef {
  pluginId: string;
  scopeId: null | string;
  targetType: string;
}

export const canOnReport = (
  c: Context,
  set: ResolvedStaffPermissionSet,
  report: ReportScopeRef,
  permission: string,
): boolean => {
  if (set.root) return true;

  const target = findReportTarget(c.get("core").moderation, {
    pluginId: report.pluginId,
    type: report.targetType,
  });
  if (!target) return false;

  return hasStaffPermission(set, {
    module: target.definition.permissionModule,
    permission,
    plugin: target.pluginId,
    ...(target.definition.scope
      ? {
          resource: {
            family: target.definition.scope,
            id: report.scopeId ?? "",
          },
        }
      : {}),
  });
};

export const viewableReportsCondition = (
  c: Context,
  set: ResolvedStaffPermissionSet,
): SQL | undefined => {
  if (set.root) return undefined;

  const table = core_moderation_reports;
  const conditions: (SQL | undefined)[] = [];
  for (const target of c.get("core").moderation?.targets ?? []) {
    const family = target.definition.scope;
    const resources = staffPermissionResources(
      set,
      {
        module: target.definition.permissionModule,
        permission: MODERATION_PERMISSIONS.viewReports,
        plugin: target.pluginId,
      },
      family ?? "",
    );
    if (resources === null) continue;

    const ofTarget = and(
      eq(table.pluginId, target.pluginId),
      eq(table.targetType, target.definition.type),
    );
    conditions.push(
      resources === "all" || !family
        ? ofTarget
        : and(
            ofTarget,
            eq(table.scopeFamily, family),
            inArray(table.scopeId, resources),
          ),
    );
  }

  return (
    (conditions.length > 0 ? or(...conditions) : undefined) ?? eq(table.id, 0)
  );
};

export const syncReportTargetScope = async (
  c: Context,
  { target, targetId }: { target: RegisteredReportTarget; targetId: string },
): Promise<null | string | undefined> => {
  const { definition, pluginId } = target;
  if (!definition.scope || !definition.resolveScope) return null;

  const current = await definition.resolveScope(c, targetId);
  if (current === undefined) return undefined;

  const table = core_moderation_reports;
  const ofTarget = and(
    eq(table.pluginId, pluginId),
    eq(table.targetType, definition.type),
    eq(table.targetId, targetId),
  );
  const stale = await c
    .get("db")
    .select({
      assigneeId: table.assigneeId,
      id: table.id,
      scopeId: table.scopeId,
      status: table.status,
      version: table.version,
    })
    .from(table)
    .where(ofTarget);

  const moved = stale.filter(report => report.scopeId !== current);
  if (moved.length === 0) return current;

  for (const report of moved) {
    await c
      .get("db")
      .update(table)
      .set({
        scopeFamily: definition.scope,
        scopeId: current,
        version: report.version + 1,
      })
      .where(and(eq(table.id, report.id), eq(table.version, report.version)));
    report.version += 1;
  }

  await revalidateAssignees(c, {
    reports: moved.filter(
      report => report.assigneeId !== null && report.status !== "done",
    ),
    scopeId: current,
    target,
  });

  return current;
};

const revalidateAssignees = async (
  c: Context,
  {
    reports,
    scopeId,
    target,
  }: {
    reports: { assigneeId: null | number; id: number; version: number }[];
    scopeId: string;
    target: RegisteredReportTarget;
  },
): Promise<void> => {
  const assigneeIds = [
    ...new Set(
      reports
        .map(report => report.assigneeId)
        .filter((id): id is number => id !== null),
    ),
  ];
  if (assigneeIds.length === 0) return;

  const users = await c
    .get("db")
    .select({ id: core_users.id, roleId: core_users.roleId })
    .from(core_users)
    .where(inArray(core_users.id, assigneeIds));

  for (const assigneeId of assigneeIds) {
    const user = users.find(row => row.id === assigneeId);
    const set = user
      ? await resolveStaffPermissions(c, { type: "moderator", user })
      : null;
    const keeps =
      set !== null &&
      canOnReport(
        c,
        set,
        {
          pluginId: target.pluginId,
          scopeId,
          targetType: target.definition.type,
        },
        MODERATION_PERMISSIONS.manageReports,
      );
    if (keeps) continue;

    const lost = reports.filter(report => report.assigneeId === assigneeId);
    await c.get("db").transaction(async tx => {
      for (const report of lost) {
        const [updated] = await tx
          .update(core_moderation_reports)
          .set({ assigneeId: null, status: "new", version: report.version + 1 })
          .where(
            and(
              eq(core_moderation_reports.id, report.id),
              eq(core_moderation_reports.version, report.version),
            ),
          )
          .returning({ id: core_moderation_reports.id });
        if (!updated) continue;
        await tx.insert(core_moderation_report_events).values({
          actorId: null,
          data: { previousAssigneeId: assigneeId, reason: "lost_access" },
          reportId: report.id,
          type: "unassigned",
        });
      }
    });
  }
};

export const syncModerationReportScope = async (
  c: Context,
  {
    pluginId,
    targetId,
    targetType,
  }: { pluginId: string; targetId: string; targetType: string },
): Promise<void> => {
  const target = findReportTarget(c.get("core").moderation, {
    pluginId,
    type: targetType,
  });
  if (!target) return;

  await syncReportTargetScope(c, { target, targetId });
};
