import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

export const requireNotificationUser = (c: Context<EnvVitNode>) => {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });

  return user;
};
