import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import { PasskeyError } from "@/api/models/passkey";

export const passkeyFailure = (c: Context, error: unknown) => {
  if (!(error instanceof PasskeyError)) throw error;

  const body = { error: error.code };

  switch (error.status) {
    case 400:
      return c.json(body, 400);
    case 403:
      return c.json(body, 403);
    case 404:
      return c.json(body, 404);
    case 409:
      return c.json(body, 409);
  }
};

export const requireSignedInUser = <User>(user: null | User): User => {
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });

  return user;
};
