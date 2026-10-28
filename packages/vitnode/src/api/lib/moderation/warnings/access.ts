import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { and, eq, inArray, isNotNull, or } from "drizzle-orm";

import { core_moderation_warnings } from "@/database/warnings";
import { MODERATION_PERMISSIONS } from "@/lib/moderation/const";
import {
  WARNING_PERMISSION_MODULE,
  WARNING_PERMISSIONS,
} from "@/lib/moderation/warnings";
import { manifest } from "@/manifest";

import type { ResolvedStaffPermissionSet } from "../../permission-staff";
import type { ModeratorContext } from "../access";

import {
  getStaffFlags,
  resolveStaffPermissions,
} from "../../check-staff-permission";
import {
  hasStaffPermission,
  staffPermissionResources,
} from "../../staff-permission";
import { canOnReport } from "../access";

export type WarningPermission =
  (typeof WARNING_PERMISSIONS)[keyof typeof WARNING_PERMISSIONS];

/** Whether the moderator holds one of core's unscoped `warnings` permissions. */
export const hasWarningPermission = (
  set: ResolvedStaffPermissionSet,
  permission: WarningPermission,
): boolean =>
  hasStaffPermission(set, {
    module: WARNING_PERMISSION_MODULE,
    permission,
    plugin: manifest.id,
  });

/** The content a warning points at, as stored on the warning. */
export interface WarningContentRef {
  pluginId: null | string;
  scopeId: null | string;
  targetType: null | string;
}

/** Whether the moderator may warn the authors of content in this scope. */
export const canWarnForContent = (
  c: Context,
  set: ResolvedStaffPermissionSet,
  ref: { pluginId: string; scopeId: null | string; targetType: string },
): boolean => canOnReport(c, set, ref, MODERATION_PERMISSIONS.warn);

/**
 * Whether the moderator may read one warning's details: with `can_view`, any
 * warning; otherwise the warnings they issued and those linked to content
 * they may warn for.
 */
export const canSeeWarning = (
  c: Context,
  moderator: ModeratorContext,
  warning: WarningContentRef & { issuedById: null | number },
): boolean => {
  if (hasWarningPermission(moderator.set, WARNING_PERMISSIONS.view)) {
    return true;
  }
  if (warning.issuedById === moderator.user.id) return true;
  if (!warning.pluginId || !warning.targetType) return false;

  return canWarnForContent(c, moderator.set, {
    pluginId: warning.pluginId,
    scopeId: warning.scopeId,
    targetType: warning.targetType,
  });
};

/** Staff notes and override explanations: `can_view_notes`, or the issuer's own. */
export const canSeeWarningNotes = (
  moderator: ModeratorContext,
  warning: { issuedById: null | number },
): boolean =>
  hasWarningPermission(moderator.set, WARNING_PERMISSIONS.viewNotes) ||
  warning.issuedById === moderator.user.id;

/** {@link canSeeWarning} as SQL, for listing. `undefined` means every warning. */
export const viewableWarningsCondition = (
  c: Context,
  moderator: ModeratorContext,
): SQL | undefined => {
  if (hasWarningPermission(moderator.set, WARNING_PERMISSIONS.view)) {
    return undefined;
  }

  const table = core_moderation_warnings;
  const conditions: (SQL | undefined)[] = [
    eq(table.issuedById, moderator.user.id),
  ];
  for (const target of c.get("core").moderation?.targets ?? []) {
    if (!target.definition.resolveAuthors) continue;
    const family = target.definition.scope;
    const resources = staffPermissionResources(
      moderator.set,
      {
        module: target.definition.permissionModule,
        permission: MODERATION_PERMISSIONS.warn,
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
            isNotNull(table.scopeId),
            inArray(table.scopeId, resources),
          ),
    );
  }

  return or(...conditions);
};

/**
 * Whether the moderator can warn anyone at all: directly, or for content of
 * at least one registered target.
 */
export const canWarnAnywhere = (
  c: Context,
  set: ResolvedStaffPermissionSet,
): boolean => {
  if (hasWarningPermission(set, WARNING_PERMISSIONS.warn)) return true;

  return (c.get("core").moderation?.targets ?? []).some(
    target =>
      target.definition.resolveAuthors !== undefined &&
      staffPermissionResources(
        set,
        {
          module: target.definition.permissionModule,
          permission: MODERATION_PERMISSIONS.warn,
          plugin: target.pluginId,
        },
        target.definition.scope ?? "",
      ) !== null,
  );
};

export type WarningTargetRefusal = "protected" | "self";

/**
 * Who may not be warned by this moderator: themselves, anyone holding a root
 * role, and - unless the moderator holds a root role - other staff. Checked
 * before threshold evaluation, so a threshold can never suspend a protected
 * account.
 */
export const warningTargetRefusal = async (
  c: Context,
  moderator: ModeratorContext,
  target: { id: number; roleId: number },
): Promise<null | WarningTargetRefusal> => {
  if (target.id === moderator.user.id) return "self";

  const targetSet = await resolveStaffPermissions(c, {
    type: "moderator",
    user: target,
  });
  if (targetSet.root) return "protected";
  if (moderator.set.root) return null;

  const flags = await getStaffFlags(c, target);

  return flags.isAdmin || flags.isModerator ? "protected" : null;
};
