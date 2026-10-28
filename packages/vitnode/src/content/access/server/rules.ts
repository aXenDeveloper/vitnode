import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import type { ContentDatabase } from "../../server/service";
import type { ContentAccessAudience, ContentAccessOverrides } from "../policy";

import {
  core_content_access_rule_roles,
  core_content_access_rules,
} from "../../../database/content-access";
import { core_roles } from "../../../database/roles";
import { CONTENT_ACCESS_ACTIONS } from "../const";
import { readContentAccessOverrides } from "../policy";

export type ContentAccessRuleMap = Map<string, ContentAccessOverrides>;

const memos = new WeakMap<
  Context,
  Map<string, Promise<ContentAccessRuleMap>>
>();

const readRules = async (
  db: ContentDatabase,
  family: string,
  scopeIds?: readonly string[],
): Promise<ContentAccessRuleMap> => {
  if (scopeIds?.length === 0) return new Map();

  const rules = await db
    .select({
      action: core_content_access_rules.action,
      id: core_content_access_rules.id,
      mode: core_content_access_rules.mode,
      scopeId: core_content_access_rules.scopeId,
    })
    .from(core_content_access_rules)
    .where(
      scopeIds
        ? and(
            eq(core_content_access_rules.family, family),
            inArray(core_content_access_rules.scopeId, [...scopeIds]),
          )
        : eq(core_content_access_rules.family, family),
    );
  if (rules.length === 0) return new Map();

  const roleRows = await db
    .select({
      roleId: core_content_access_rule_roles.roleId,
      ruleId: core_content_access_rule_roles.ruleId,
    })
    .from(core_content_access_rule_roles)
    .where(
      inArray(
        core_content_access_rule_roles.ruleId,
        rules.map(rule => rule.id),
      ),
    );
  const rolesOf = new Map<number, number[]>();
  for (const row of roleRows) {
    rolesOf.set(row.ruleId, [...(rolesOf.get(row.ruleId) ?? []), row.roleId]);
  }

  const raw = new Map<string, Record<string, unknown>>();
  for (const rule of rules) {
    const entry = raw.get(rule.scopeId) ?? {};
    entry[rule.action] =
      rule.mode === "roles"
        ? { mode: "roles", roleIds: rolesOf.get(rule.id) ?? [] }
        : { mode: rule.mode };
    raw.set(rule.scopeId, entry);
  }

  // Through the defensive reader: an unknown mode becomes deny-all rather
  // than nothing, and an unknown action is ignored.
  return new Map(
    [...raw].map(([scopeId, value]) => [
      scopeId,
      readContentAccessOverrides(value),
    ]),
  );
};

/**
 * Every stored rule of one scope family, keyed by scope id. Read live once per
 * request, so a rule saved a moment ago applies on the next request. Server-only.
 */
export const loadContentAccessRules = async (
  c: Context,
  family: string,
): Promise<ContentAccessRuleMap> => {
  let memo = memos.get(c);
  if (!memo) {
    memo = new Map();
    memos.set(c, memo);
  }

  const remembered = memo.get(family);
  if (remembered) return await remembered;

  const promise = readRules(c.get("db"), family);
  memo.set(family, promise);

  return await promise;
};

export const forgetContentAccessRules = (c: Context): void => {
  memos.delete(c);
};

export class ContentAccessRoleError extends Error {
  constructor(roleIds: number[]) {
    super(`Unknown or unusable role ids: ${roleIds.join(", ")}.`);
    this.name = "ContentAccessRoleError";
    this.roleIds = roleIds;
  }

  readonly roleIds: number[];
}

/**
 * The role ids among `ids` that cannot be used in an audience: missing ones and
 * the guest role (an audience of roles is for signed-in members).
 */
export const unusableContentAccessRoleIds = async (
  db: ContentDatabase,
  ids: readonly number[],
): Promise<number[]> => {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ guest: core_roles.guest, id: core_roles.id })
    .from(core_roles)
    .where(inArray(core_roles.id, [...ids]));
  const usable = new Set(rows.filter(row => !row.guest).map(row => row.id));

  return ids.filter(id => !usable.has(id));
};

/**
 * Replaces one scope's rules with `overrides` in one transaction. An action
 * left out inherits. Validated by the caller with `zodContentAccessOverrides`.
 *
 * @throws {ContentAccessRoleError} When an audience names a role that does not
 * exist or is the guest role.
 */
export const replaceContentAccessRules = async (
  db: ContentDatabase,
  {
    family,
    overrides,
    scopeId,
  }: { family: string; overrides: ContentAccessOverrides; scopeId: string },
): Promise<void> => {
  const roleIds = [
    ...new Set(
      Object.values(overrides).flatMap(audience =>
        audience?.mode === "roles" ? audience.roleIds : [],
      ),
    ),
  ];

  await db.transaction(async tx => {
    const unusable = await unusableContentAccessRoleIds(tx, roleIds);
    if (unusable.length > 0) throw new ContentAccessRoleError(unusable);

    await tx
      .delete(core_content_access_rules)
      .where(
        and(
          eq(core_content_access_rules.family, family),
          eq(core_content_access_rules.scopeId, scopeId),
        ),
      );

    const entries = CONTENT_ACCESS_ACTIONS.flatMap(action => {
      const audience = overrides[action];

      return audience ? [[action, audience] as const] : [];
    });
    if (entries.length === 0) return;

    const inserted = await tx
      .insert(core_content_access_rules)
      .values(
        entries.map(([action, audience]) => ({
          action,
          family,
          mode: audience.mode,
          scopeId,
        })),
      )
      .returning({
        action: core_content_access_rules.action,
        id: core_content_access_rules.id,
      });

    const audienceOf = new Map<string, ContentAccessAudience>(entries);
    const links = inserted.flatMap(rule => {
      const audience = audienceOf.get(rule.action);

      return audience?.mode === "roles"
        ? audience.roleIds.map(roleId => ({ roleId, ruleId: rule.id }))
        : [];
    });
    if (links.length > 0) {
      await tx.insert(core_content_access_rule_roles).values(links);
    }
  });
};

/** Removes every rule of the given scopes, when the scopes themselves go. */
export const deleteContentAccessRules = async (
  db: ContentDatabase,
  family: string,
  scopeIds: readonly string[],
): Promise<void> => {
  if (scopeIds.length === 0) return;
  await db
    .delete(core_content_access_rules)
    .where(
      and(
        eq(core_content_access_rules.family, family),
        inArray(core_content_access_rules.scopeId, [...scopeIds]),
      ),
    );
};

/** Whether any rule of the family exists at all, for diagnostics. */
export const readContentAccessRulesOf = readRules;
