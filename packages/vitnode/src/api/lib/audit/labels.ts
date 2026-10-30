import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { MultiLangValue } from "@/lib/helpers/multi-lang";

import { core_users } from "@/database/users";

import type { PermissionsStaffArgs } from "../permission-staff";

import { resolveRoleNames } from "../resolve-role-names";

/**
 * One readable label out of a multi-language value: the default language's,
 * else English, else the first one stored. `null` when there is none.
 */
export const multiLangAuditLabel = (
  values: MultiLangValue | null | undefined,
  defaultLocale?: string,
): null | string => {
  if (!values || values.length === 0) return null;
  const pick =
    values.find(entry => entry.languageCode === defaultLocale) ??
    values.find(entry => entry.languageCode === "en") ??
    values[0];

  return pick.value.trim() === "" ? null : pick.value;
};

/** A role's name as an audit label, read from its stored translations. */
export const roleAuditLabel = async (
  c: Context,
  roleId: number,
): Promise<null | string> => {
  const names = (await resolveRoleNames(c, [roleId])).get(roleId) ?? [];

  return multiLangAuditLabel(
    names.map(entry => ({
      languageCode: entry.languageCode,
      value: entry.name,
    })),
    c.get("core")?.i18n?.defaultLocale,
  );
};

/** A user's display name as an audit label. */
export const userAuditLabel = async (
  c: Context,
  userId: number,
): Promise<null | string> => {
  const [row] = await c
    .get("db")
    .select({ name: core_users.name })
    .from(core_users)
    .where(eq(core_users.id, userId))
    .limit(1);

  return row?.name ?? null;
};

/** Whom a staff permission entry governs - a role or one user - as a label. */
export const staffEntryAuditLabel = async (
  c: Context,
  entry: {
    roleId: null | number | undefined;
    userId: null | number | undefined;
  },
): Promise<null | string> => {
  if (typeof entry.roleId === "number")
    return await roleAuditLabel(c, entry.roleId);
  if (typeof entry.userId === "number")
    return await userAuditLabel(c, entry.userId);

  return null;
};

/** One staff grant as a stable string: `@vitnode/core:users:can_edit[forum:1,2]`. */
export const staffGrantAuditKey = (grant: PermissionsStaffArgs): string => {
  const base = `${grant.plugin}:${grant.module}:${grant.permission}`;
  if (!grant.scope) return base;

  return grant.scope.mode === "all"
    ? `${base}[${grant.scope.family}:*]`
    : `${base}[${grant.scope.family}:${[...grant.scope.ids].sort().join(",")}]`;
};

/**
 * What changed between two grant lists, as audit metadata: the grants added and
 * the grants removed, never the full lists.
 */
export const staffGrantsAuditDelta = (
  before: readonly PermissionsStaffArgs[],
  after: readonly PermissionsStaffArgs[],
): { granted: string[]; revoked: string[] } => {
  const from = new Set(before.map(staffGrantAuditKey));
  const to = new Set(after.map(staffGrantAuditKey));

  return {
    granted: [...to].filter(key => !from.has(key)).sort(),
    revoked: [...from].filter(key => !to.has(key)).sort(),
  };
};
