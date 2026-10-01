import type { Context } from "hono";

import { SsoConnectionError } from "@/api/models/sso-connection";

export const ssoConnectionFailure = (c: Context, error: unknown) => {
  if (!(error instanceof SsoConnectionError)) throw error;

  const body = { error: error.code };

  switch (error.status) {
    case 400:
      return c.json(body, 400);
    case 404:
      return c.json(body, 404);
    case 409:
      return c.json(body, 409);
    case 502:
      return c.json(body, 502);
  }
};
