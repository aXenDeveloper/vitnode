import type { Context } from "hono";

import { eq } from "drizzle-orm";

import { core_users } from "@/database/users";

export const getUserByNameCode = async ({
  nameCode,
  c,
}: {
  c: Context;
  nameCode: string;
}) => {
  const [user] = await c
    .get("db")
    .select({
      id: core_users.id,
      email: core_users.email,
      name: core_users.name,
      nameCode: core_users.nameCode,
      createdAt: core_users.createdAt,
      newsletter: core_users.newsletter,
      avatarColor: core_users.avatarColor,
      emailVerified: core_users.emailVerified,
      roleId: core_users.roleId,
      birthday: core_users.birthday,
      language: core_users.language,
    })
    .from(core_users)
    .where(eq(core_users.nameCode, nameCode))
    .limit(1);
  if (!user) return null;

  return user;
};
