import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

export const cronAuthMiddleware = () => {
  return async (c: Context, next: Next) => {
    const cronSecret = c.get("core").cronSecret;
    if (!cronSecret) {
      throw new HTTPException(403, { message: "Cron access not configured" });
    }

    const authHeader = c.req.header("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    if (providedSecret !== cronSecret) {
      throw new HTTPException(403, { message: "Invalid cron authorization" });
    }

    await next();
  };
};
