import type { Context } from "hono";

import type { EnvVariablesVitNode } from "../../middlewares/global.middleware";

import { UserModel } from "../../models/user";
import { findActiveSuspension } from "../moderation/warnings/suspension";

/**
 * The member an MCP token acts for, loaded like the session's member: `null`
 * when the account is gone or suspended. Server-only.
 */
export const loadMcpUser = async (
  c: Context,
  userId: number,
): Promise<EnvVariablesVitNode["user"]> => {
  const [user, suspension] = await Promise.all([
    new UserModel().getUserById({ c, id: userId }),
    findActiveSuspension(c, userId),
  ]);

  return user && !suspension ? user : null;
};
