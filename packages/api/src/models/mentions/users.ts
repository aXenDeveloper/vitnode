import type { Context } from "hono";

import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import { core_users_deletions } from "@/database/account-deletions";
import { core_files } from "@/database/files";
import { core_users } from "@/database/users";
import { OPEN_ACCOUNT_DELETION_STATUSES } from "@/lib/account-deletion/requests";
import { storageUrlOf } from "@/lib/storage-url";

/** Most members one `GET /users/mentioned` call resolves. */
export const MENTIONED_USERS_MAX_IDS = 50;

/** Most suggestions one `GET /users/mentions` call returns. */
export const MENTION_SUGGESTIONS_MAX = 10;

/** A member offered in the `@` popup. */
export interface MentionCandidate {
  avatarColor: string;
  avatarUrl: null | string;
  id: number;
  name: string;
  nameCode: string;
}

/** A mentioned member's current name and URL name. */
export interface MentionedUser {
  id: number;
  name: string;
  nameCode: string;
}

const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, char => `\\${char}`);

/** Members with an account deletion on the way look deleted already. */
const notBeingDeleted = notExists(
  sql`(select 1 from ${core_users_deletions} where ${core_users_deletions.userId} = ${core_users.id} and ${inArray(core_users_deletions.status, OPEN_ACCOUNT_DELETION_STATUSES)})`,
);

/**
 * Members whose URL name or name starts with `term`, then whose name contains
 * it - for the editor's `@` popup, without the member typing. Server-only.
 */
export const searchMentionCandidates = async (
  c: Context,
  {
    excludeUserId,
    limit,
    term,
  }: { excludeUserId?: number; limit: number; term: string },
): Promise<MentionCandidate[]> => {
  const escaped = escapeLike(term.toLowerCase());
  const prefix = `${escaped}%`;
  const rank = sql<number>`case
    when lower(${core_users.nameCode}) like ${prefix} then 0
    when lower(${core_users.name}) like ${prefix} then 1
    else 2 end`;

  const rows = await c
    .get("db")
    .select({
      avatarColor: core_users.avatarColor,
      avatarKey: core_files.key,
      id: core_users.id,
      name: core_users.name,
      nameCode: core_users.nameCode,
    })
    .from(core_users)
    .leftJoin(core_files, eq(core_files.id, core_users.avatarId))
    .where(
      and(
        or(
          sql`lower(${core_users.nameCode}) like ${prefix}`,
          ilike(core_users.name, `%${escaped}%`),
        ),
        notBeingDeleted,
        excludeUserId === undefined
          ? undefined
          : ne(core_users.id, excludeUserId),
      ),
    )
    .orderBy(rank, asc(sql`length(${core_users.name})`), asc(core_users.name))
    .limit(limit);

  return rows.map(row => ({
    avatarColor: row.avatarColor,
    avatarUrl: storageUrlOf(c, row.avatarKey),
    id: row.id,
    name: row.name,
    nameCode: row.nameCode,
  }));
};

/**
 * The current name and URL name of every member still around among `ids` -
 * a missing id is a deleted member. Server-only.
 */
export const loadMentionedUsers = async (
  c: Context,
  ids: readonly number[],
): Promise<MentionedUser[]> => {
  if (ids.length === 0) return [];

  return await c
    .get("db")
    .select({
      id: core_users.id,
      name: core_users.name,
      nameCode: core_users.nameCode,
    })
    .from(core_users)
    .where(and(inArray(core_users.id, [...ids]), notBeingDeleted))
    .orderBy(asc(core_users.id));
};
