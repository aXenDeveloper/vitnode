import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import { matchesEmail, pickAccountForEmail } from "@/api/lib/user-email-lookup";
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
  const candidates = await c
    .get("db")
    .select({
      id: core_users.id,
      email: core_users.email,
      emailVerified: core_users.emailVerified,
      password: core_users.password,
    })
    .from(core_users)
    .where(matchesEmail(email))
    .limit(2);
  const user = pickAccountForEmail(candidates, email);

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

  // Whether the address is confirmed is only ever reported from here - after
  // the password has been proven. Saying so any earlier would tell a stranger
  // which addresses hold an unconfirmed account without them knowing a single
  // password.
  return { id: user.id, email: user.email, emailVerified: user.emailVerified };
};
