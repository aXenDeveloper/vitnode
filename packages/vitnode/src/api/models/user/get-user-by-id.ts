import { dbClient } from '@/database/client';
import { core_users } from '@/database/schema/users';
import { eq } from 'drizzle-orm';

export const getUserById = async (id: number) => {
  const [user] = await dbClient
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
    })
    .from(core_users)
    .where(eq(core_users.id, id))
    .limit(1);
  if (!user) return null;

  return user;
};
