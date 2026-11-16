import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type { ModeratorContext } from "@/lib/moderation/access";

import { requireModerator } from "@/lib/moderation/access";
import { canWarnAnywhere } from "@/lib/moderation/warnings/access";

export const requireWarner = async (c: Context): Promise<ModeratorContext> => {
  const moderator = await requireModerator(c);
  if (!canWarnAnywhere(c, moderator.set)) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  return moderator;
};
