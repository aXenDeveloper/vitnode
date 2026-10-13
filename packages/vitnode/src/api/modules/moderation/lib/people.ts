import type { Context } from "hono";

import { eq, inArray } from "drizzle-orm";

import { storageUrlOf } from "@/api/lib/storage-url";
import { core_files } from "@/database/files";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";

export interface ReportPerson {
  avatarColor: string;
  avatarUrl: null | string;
  id: number;
  name: string;
  nameCode: string;
  role: { color: null | string; prefix: null | string };
}

export const loadReportPeople = async (
  c: Context,
  ids: readonly (null | number | undefined)[],
): Promise<Map<number, ReportPerson>> => {
  const unique = [
    ...new Set(ids.filter((id): id is number => typeof id === "number")),
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
