import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type { ModeratorContext } from "@/api/lib/moderation/access";

import { requireModerator } from "@/api/lib/moderation/access";
import { canWarnAnywhere } from "@/api/lib/moderation/warnings/access";

export const requireWarner = async (c: Context): Promise<ModeratorContext> => {
  const moderator = await requireModerator(c);
  if (!canWarnAnywhere(c, moderator.set)) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  return moderator;
};
