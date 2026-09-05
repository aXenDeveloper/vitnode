import { z } from "zod";

export interface PasswordResetFormMessages {
  /** Shown when the email field is not an email address. */
  invalidEmail: string;
}

export const createPasswordResetFormSchema = ({
  invalidEmail,
}: PasswordResetFormMessages) =>
  z.object({
    email: z.email({ message: invalidEmail }).default(""),
  });

export type PasswordResetFormSchema = ReturnType<
  typeof createPasswordResetFormSchema
>;
export type PasswordResetFormValues = z.infer<PasswordResetFormSchema>;

/** What the form sends: the address, and the captcha the route requires. */
export interface PasswordResetSubmitValues {
  captchaToken: string;
  email: string;
}

export type PasswordResetMutationResult =
  undefined | { message: "Internal Server Error" };

export const passwordResetFormOutcome = (
  result: PasswordResetMutationResult,
): { kind: "confirmation" } | { kind: "toast" } =>
  result?.message ? { kind: "toast" } : { kind: "confirmation" };
