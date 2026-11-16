import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { core_users } from "@/database/users";

const MAX_USER_ID = 2_147_483_647;

export const zodTargetUserIdParam = z.string().openapi({ example: "1" });

export const zodTargetUserParams = z.object({ id: zodTargetUserIdParam });

export const userNotFoundResponse = {
  content: {
    "application/json": {
      schema: z.object({ error: z.string() }),
    },
  },
  description: "User not found",
};

export const USER_NOT_FOUND = { error: "User not found" };

const parseUserId = (id: string): null | number => {
  if (!/^[1-9]\d{0,9}$/.test(id)) return null;
  const userId = Number(id);

  return userId <= MAX_USER_ID ? userId : null;
};

export const findTargetUserId = async (
  c: Context,
  id: string,
): Promise<null | number> => {
  const userId = parseUserId(id);
  if (userId === null) return null;

  const [user] = await c
    .get("db")
    .select({ id: core_users.id })
    .from(core_users)
    .where(eq(core_users.id, userId))
    .limit(1);

  return user?.id ?? null;
};
