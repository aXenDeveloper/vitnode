import type { Context } from "hono";

import { eq, inArray } from "drizzle-orm";

import type { ContentPublicPerson } from "@/content/public-person";

import { storageUrlOf } from "@/api/lib/storage-url";
import { core_files } from "@/database/files";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";

export type { ContentPublicPerson } from "@/content/public-person";
export { zodContentPublicPerson as zodPublicPerson } from "@/content/public-person";

export type PublicPerson = ContentPublicPerson;

/** One query for every person a page names, keyed by user id. */
export const loadPublicPeople = async (
  c: Context,
  ids: readonly unknown[],
): Promise<Map<number, PublicPerson>> => {
  const unique = [
    ...new Set(
      ids.filter((id): id is number => typeof id === "number" && id > 0),
    ),
  ];
  if (unique.length === 0) return new Map();

  const rows = await c
    .get("db")
    .select({
      avatarColor: core_users.avatarColor,
      avatarKey: core_files.key,
      id: core_users.id,
      name: core_users.name,
      nameCode: core_users.nameCode,
      roleColor: core_roles.color,
      rolePrefix: core_roles.prefix,
    })
    .from(core_users)
    .leftJoin(core_roles, eq(core_roles.id, core_users.roleId))
    .leftJoin(core_files, eq(core_files.id, core_users.avatarId))
    .where(inArray(core_users.id, unique));

  return new Map(
    rows.map(row => [
      row.id,
      {
        avatarColor: row.avatarColor,
        avatarUrl: storageUrlOf(c, row.avatarKey),
        id: row.id,
        name: row.name,
        nameCode: row.nameCode,
        role: { color: row.roleColor ?? null, prefix: row.rolePrefix ?? null },
      },
    ]),
  );
};
