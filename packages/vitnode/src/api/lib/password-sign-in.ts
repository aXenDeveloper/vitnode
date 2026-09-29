import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

export const isPasswordSignInEnabled = (c: Context): boolean =>
  c.get("core").authorization.password.enabled;

export const assertPasswordSignInEnabled = (c: Context): void => {
  if (!isPasswordSignInEnabled(c)) {
    throw new HTTPException(403, { message: "Password sign-in is disabled" });
  }
};
