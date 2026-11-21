import { z } from "zod";

import type { SignInMethod } from "../../last-sign-in-method";

export const ACCOUNT_DELETION_PENDING = "account_deletion_pending";

export interface AccountDeletionHold {
  scheduledAt: Date;
  token: string;
}

export interface HeldSignIn extends AccountDeletionHold {
  method: SignInMethod;
}

export type CancelDeletionSignInFailure = "invalid_hold" | "server_error";

export type CancelDeletionSignInSubmit = (
  hold: HeldSignIn,
) => Promise<CancelDeletionSignInFailure | undefined>;

const accountDeletionHoldBodySchema = z.object({
  error: z.literal(ACCOUNT_DELETION_PENDING),
  scheduledAt: z.coerce.date(),
  token: z.string().min(16).max(2048),
});

export const accountDeletionHoldOf = (
  body: unknown,
): AccountDeletionHold | null => {
  const parsed = accountDeletionHoldBodySchema.safeParse(body);

  return parsed.success
    ? { scheduledAt: parsed.data.scheduledAt, token: parsed.data.token }
    : null;
};
