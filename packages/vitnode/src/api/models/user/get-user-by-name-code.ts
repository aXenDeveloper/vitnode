import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { storageUrlOf } from "@/api/lib/storage-url";
import { core_files } from "@/database/files";
import { core_users } from "@/database/users";

const avatarFile = alias(core_files, "user_avatar_file");
const coverFile = alias(core_files, "user_cover_file");

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
      firstName: core_users.firstName,
      lastName: core_users.lastName,
      headline: core_users.headline,
      showRealName: core_users.showRealName,
      createdAt: core_users.createdAt,
      newsletter: core_users.newsletter,
      avatarColor: core_users.avatarColor,
      emailVerified: core_users.emailVerified,
      roleId: core_users.roleId,
      birthday: core_users.birthday,
      language: core_users.language,
      avatarKey: avatarFile.key,
      coverKey: coverFile.key,
    })
    .from(core_users)
    .leftJoin(avatarFile, eq(avatarFile.id, core_users.avatarId))
    .leftJoin(coverFile, eq(coverFile.id, core_users.coverId))
    .where(eq(core_users.nameCode, nameCode))
    .limit(1);
  if (!user) return null;

  const { avatarKey, coverKey, ...rest } = user;

  return {
    ...rest,
    avatarUrl: storageUrlOf(c, avatarKey),
    coverUrl: storageUrlOf(c, coverKey),
  };
};
