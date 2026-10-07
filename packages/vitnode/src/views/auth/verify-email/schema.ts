import { z } from "zod";

/** What spending a confirmation link can come back with. */
export type ConfirmEmailMutationResult =
  | { email: string; kind: "confirmed" }
  | { kind: "error" }
  | { kind: "invalid_token" };

export type ConfirmEmailSubmit = () => Promise<ConfirmEmailMutationResult>;

export const createResendVerificationFormSchema = (
  { invalidEmail }: { invalidEmail: string },
  { defaultEmail = "" }: { defaultEmail?: string } = {},
) =>
  z.object({
    email: z.email({ message: invalidEmail }).default(defaultEmail),
  });

export type ResendVerificationFormSchema = ReturnType<
  typeof createResendVerificationFormSchema
>;

/** What the resend form sends: the address, and the captcha the route requires. */
export interface ResendVerificationSubmitValues {
  captchaToken: string;
  email: string;
}

/**
 * Only "accepted" or "the request failed". The API answers the same 201 for an
 * address with an unconfirmed account and for one without, so there is no third
 * outcome here that could tell them apart.
 */
export type ResendVerificationMutationResult =
  undefined | { message: "Internal Server Error" };

export type ResendVerificationSubmit = (
  values: ResendVerificationSubmitValues,
) => Promise<ResendVerificationMutationResult>;
