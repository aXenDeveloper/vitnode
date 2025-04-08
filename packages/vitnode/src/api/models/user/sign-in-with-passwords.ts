import { dbClient } from '@/database/client';
import { core_users } from '@/database/schema/users';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { PasswordModel } from '../password';

export const signInWithPassword = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const [user] = await dbClient
    .select({
      id: core_users.id,
      email: core_users.email,
      password: core_users.password,
    })
    .from(core_users)
    .where(eq(core_users.email, email))
    .limit(1);

  if (!user?.password) {
    throw new HTTPException(403);
  }

  const validPassword = await new PasswordModel().verifyPassword(
    password,
    user.password,
  );

  if (!validPassword) {
    throw new HTTPException(403);
  }

  return { id: user.id, email: user.email };
};
