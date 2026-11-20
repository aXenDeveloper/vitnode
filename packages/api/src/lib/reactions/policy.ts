import type { Context } from "hono";

import { inArray } from "drizzle-orm";

import { core_roles } from "@/database/roles";
import { getUserRoleIds } from "@/lib/check-staff-permission";

import type { ReactionCatalogEntry } from "./catalog";

/** One role's reaction settings. */
export interface RoleReactionSettings {
  allowReact: boolean;
  allowReactOwnContent: boolean;
  id: number;
  /** `null` = unlimited. */
  maxReactionsPerItem: null | number;
  /** `null` = unlimited. */
  reactionsPerDay: null | number;
}

/** What one member may do with reactions, from all their roles. */
export interface ReactionViewerPolicy {
  /** Signed in, not suspended, and one of their roles allows reacting. */
  canReact: boolean;
  /** One of the roles that may react also allows reacting to own records. */
  canReactOwnContent: boolean;
  /** Different reactions on one item; `null` = unlimited. */
  maxPerItem: null | number;
  /** Usable reactions by id, each with its own daily limit (`null` = unlimited). */
  reactions: Map<number, { dailyLimit: null | number }>;
  /** Reactions per day over every reaction; `null` = unlimited. */
  totalPerDay: null | number;
}

const NO_REACTIONS: ReactionViewerPolicy = {
  canReact: false,
  canReactOwnContent: false,
  maxPerItem: 0,
  reactions: new Map(),
  totalPerDay: 0,
};

/** The most generous of several limits: any `null` wins, otherwise the highest. */
export const mostGenerousLimit = (
  limits: readonly (null | number)[],
): null | number => {
  if (limits.length === 0) return 0;
  if (limits.includes(null)) return null;

  return Math.max(...(limits as number[]));
};

/**
 * One reaction's limit for a set of roles, or `undefined` when none of them
 * may use it. A role with its own row gets that row's limit; on an "all roles"
 * reaction a role without a row is unlimited.
 */
export const reactionLimitForRoles = (
  reaction: Pick<ReactionCatalogEntry, "allRoles" | "roles">,
  roleIds: readonly number[],
): undefined | { dailyLimit: null | number } => {
  const rows = new Map(reaction.roles.map(row => [row.roleId, row.dailyLimit]));
  const limits = roleIds.flatMap(roleId => {
    if (rows.has(roleId)) return [rows.get(roleId) ?? null];

    return reaction.allRoles ? [null] : [];
  });
  if (limits.length === 0) return undefined;

  return { dailyLimit: mostGenerousLimit(limits) };
};

/**
 * What a member's roles allow together; the most generous role wins every
 * limit. Only roles with `allowReact` count, so a role that cannot react
 * never opens a reaction through its own row. Pure.
 */
export const effectiveReactionPolicy = (
  roles: readonly RoleReactionSettings[],
  catalog: readonly ReactionCatalogEntry[],
): ReactionViewerPolicy => {
  const reacting = roles.filter(role => role.allowReact);
  if (reacting.length === 0) return NO_REACTIONS;

  const roleIds = reacting.map(role => role.id);
  const reactions = new Map<number, { dailyLimit: null | number }>();
  for (const reaction of catalog) {
    if (!reaction.enabled) continue;
    const limit = reactionLimitForRoles(reaction, roleIds);
    if (limit) reactions.set(reaction.id, limit);
  }

  return {
    canReact: true,
    canReactOwnContent: reacting.some(role => role.allowReactOwnContent),
    maxPerItem: mostGenerousLimit(
      reacting.map(role => role.maxReactionsPerItem),
    ),
    reactions,
    totalPerDay: mostGenerousLimit(reacting.map(role => role.reactionsPerDay)),
  };
};

const resolved = new WeakMap<Context, Promise<ReactionViewerPolicy>>();

const readPolicy = async (
  c: Context,
  catalog: readonly ReactionCatalogEntry[],
): Promise<ReactionViewerPolicy> => {
  const user = c.get("user");
  if (!user) return NO_REACTIONS;

  const roleIds = await getUserRoleIds(c, user);
  const roles = await c
    .get("db")
    .select({
      allowReact: core_roles.allowReact,
      allowReactOwnContent: core_roles.allowReactOwnContent,
      id: core_roles.id,
      maxReactionsPerItem: core_roles.maxReactionsPerItem,
      reactionsPerDay: core_roles.reactionsPerDay,
    })
    .from(core_roles)
    .where(inArray(core_roles.id, roleIds));

  return effectiveReactionPolicy(roles, catalog);
};

/**
 * The signed-in member's reaction policy, read once per request. Guests and
 * suspended members (who reach routes as guests) get nothing. Server-only.
 */
export const resolveReactionPolicy = async (
  c: Context,
  catalog: readonly ReactionCatalogEntry[],
): Promise<ReactionViewerPolicy> => {
  const cached = resolved.get(c);
  if (cached) return await cached;

  const policy = readPolicy(c, catalog);
  resolved.set(c, policy);

  return await policy;
};
