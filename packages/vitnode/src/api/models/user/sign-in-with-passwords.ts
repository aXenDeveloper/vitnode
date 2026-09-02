import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { core_users } from "@/database/users";

import { PasswordModel } from "../password";

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
    .get("db")
    .select({
      id: core_users.id,
      email: core_users.email,
      password: core_users.password,
    })
    .from(core_users)
    .where(eq(core_users.email, email))
    .limit(1);

  const passwords = new PasswordModel();

  // Both branches derive a key before answering. Returning early here - which is
  // what this did - made "no account with that email" measurably faster than
  // "wrong password", so anyone could sift a list of addresses for the ones that
  // are registered simply by timing the 403s.
  if (!user?.password) {
    await passwords.verifyDummyPassword(password);

    throw new HTTPException(403);
  }

  const validPassword = await passwords.verifyPassword(password, user.password);

  if (!validPassword) {
    throw new HTTPException(403);
  }

  return { id: user.id, email: user.email };
};
