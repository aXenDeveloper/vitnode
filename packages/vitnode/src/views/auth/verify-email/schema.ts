import { z } from "zod";

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

export interface ResendVerificationSubmitValues {
  captchaToken: string;
  email: string;
}

export type ResendVerificationMutationResult =
  | undefined
  | { message: "Internal Server Error" };

export type ResendVerificationSubmit = (
  values: ResendVerificationSubmitValues,
) => Promise<ResendVerificationMutationResult>;
