import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { core_users } from '@/database/users';

import { PasswordModel } from '../password';

export const signInWithPassword = async ({
  email,
  password,
  c,
}: {
  c: Context;
  email: string;
  password: string;
}) => {
  const [user] = await c
    .get('db')
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
