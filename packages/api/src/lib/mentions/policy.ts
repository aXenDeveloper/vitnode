import type { Context } from "hono";

import { eq, inArray } from "drizzle-orm";

import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { getUserRoleIds } from "@/lib/check-staff-permission";
import { mostGenerousLimit } from "@/lib/reactions/policy";

/** One role's mention settings. */
export interface RoleMentionSettings {
  allowMentions: boolean;
  /** `null` = unlimited. */
  maxMentionsPerItem: null | number;
}

/** What one member may do with `@mentions`, from all their roles. */
export interface MentionPolicy {
  /** One of their roles allows mentioning others. */
  canMention: boolean;
  /** Members one record of theirs notifies by mentions; `null` = unlimited. */
  maxPerItem: null | number;
}

const NO_MENTIONS: MentionPolicy = { canMention: false, maxPerItem: 0 };

/**
 * What a member's roles allow together; the most generous role wins. Only
 * roles with `allowMentions` count. Pure.
 */
export const effectiveMentionPolicy = (
  roles: readonly RoleMentionSettings[],
): MentionPolicy => {
  const mentioning = roles.filter(role => role.allowMentions);
  if (mentioning.length === 0) return NO_MENTIONS;

  return {
    canMention: true,
    maxPerItem: mostGenerousLimit(
      mentioning.map(role => role.maxMentionsPerItem),
    ),
  };
};

/**
 * The mention policy of any member, e.g. the author of a record a background
 * task processes. Server-only.
 */
export const mentionPolicyOf = async (
  c: Context,
  user: { id: number; roleId: number },
): Promise<MentionPolicy> => {
  const roleIds = await getUserRoleIds(c, user);
  const roles = await c
    .get("db")
    .select({
      allowMentions: core_roles.allowMentions,
      maxMentionsPerItem: core_roles.maxMentionsPerItem,
    })
    .from(core_roles)
    .where(inArray(core_roles.id, roleIds));

  return effectiveMentionPolicy(roles);
};

/** The mention policy of a member by id; nothing for an unknown id. Server-only. */
export const mentionPolicyOfUserId = async (
  c: Context,
  userId: null | number | undefined,
): Promise<MentionPolicy> => {
  if (!userId) return NO_MENTIONS;

  const [user] = await c
    .get("db")
    .select({ id: core_users.id, roleId: core_users.roleId })
    .from(core_users)
    .where(eq(core_users.id, userId))
    .limit(1);

  return user ? await mentionPolicyOf(c, user) : NO_MENTIONS;
};

const resolved = new WeakMap<Context, Promise<MentionPolicy>>();

/**
 * The signed-in member's mention policy, read once per request. Guests and
 * suspended members (who reach routes as guests) get nothing. Server-only.
 */
export const resolveMentionPolicy = async (
  c: Context,
): Promise<MentionPolicy> => {
  const cached = resolved.get(c);
  if (cached) return await cached;

  const user = c.get("user");
  const policy = user ? mentionPolicyOf(c, user) : Promise.resolve(NO_MENTIONS);
  resolved.set(c, policy);

  return await policy;
};
