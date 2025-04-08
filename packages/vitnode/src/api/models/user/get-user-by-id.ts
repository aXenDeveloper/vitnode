import { dbClient } from '@/database/client';
import { core_users } from '@/database/schema/users';
import { eq } from 'drizzle-orm';

export const getUserById = async (id: string) => {
  const [user] = await dbClient
    .select({
      id: core_users.id,
      email: core_users.email,
      name: core_users.name,
      name_code: core_users.name_code,
      joined_at: core_users.joined_at,
      newsletter: core_users.newsletter,
      avatar_color: core_users.avatar_color,
      email_verified: core_users.email_verified,
      group_id: core_users.group_id,
      birthday: core_users.birthday,
    })
    .from(core_users)
    .where(eq(core_users.id, id))
    .limit(1);
  if (!user) return null;

  return user;
};
