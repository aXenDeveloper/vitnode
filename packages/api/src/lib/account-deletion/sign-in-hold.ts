import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import { signPayload, verifySignedPayload } from "@/lib/api/signed-token";
import { ensureServerSecret } from "@/lib/server-secret";

import { cancelAccountDeletion, findOpenAccountDeletion } from "./requests";

export const ACCOUNT_DELETION_PENDING = "account_deletion_pending";

export const ACCOUNT_DELETION_HOLD_SECRET_NAME = "account_deletion_hold";

export const ACCOUNT_DELETION_HOLD_TTL_MS = 10 * 60_000;

export const zodAccountDeletionHold = z.object({
  error: z.literal(ACCOUNT_DELETION_PENDING),
  scheduledAt: z.date(),
  token: z.string(),
});

export type AccountDeletionHold = z.infer<typeof zodAccountDeletionHold>;

const zodHoldTokenPayload = z.object({
  aud: z.literal("account-deletion-hold"),
  d: z.number().int().positive(),
  exp: z.number().int().positive(),
  u: z.number().int().positive(),
});

const holdSecret = async (c: Context<EnvVitNode>): Promise<string> =>
  await ensureServerSecret(c.get("db"), ACCOUNT_DELETION_HOLD_SECRET_NAME);

export const holdSignInForAccountDeletion = async (
  c: Context<EnvVitNode>,
  userId: number,
): Promise<AccountDeletionHold | null> => {
  const deletion = await findOpenAccountDeletion(c, userId);
  if (!deletion) return null;

  const expiresAt = Date.now() + ACCOUNT_DELETION_HOLD_TTL_MS;

  return {
    error: ACCOUNT_DELETION_PENDING,
    scheduledAt: deletion.scheduledAt,
    token: signPayload(await holdSecret(c), {
      aud: "account-deletion-hold",
      d: deletion.id,
      exp: Math.floor(expiresAt / 1000),
      u: userId,
    }),
  };
};

export const assertNoAccountDeletion = async (
  c: Context<EnvVitNode>,
  userId: number,
): Promise<void> => {
  if (await findOpenAccountDeletion(c, userId)) {
    throw new HTTPException(403);
  }
};

export const releaseAccountDeletionHold = async (
  c: Context<EnvVitNode>,
  token: string,
): Promise<null | number> => {
  const payload = verifySignedPayload(
    await holdSecret(c),
    token,
    zodHoldTokenPayload,
  );
  if (!payload || payload.exp * 1000 <= Date.now()) return null;

  const deletion = await findOpenAccountDeletion(c, payload.u);
  if (deletion?.id !== payload.d) return null;

  if (!(await cancelAccountDeletion(c, payload.u))) return null;

  return payload.u;
};
