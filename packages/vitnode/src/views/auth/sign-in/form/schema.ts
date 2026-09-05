import { z } from "zod";

export interface SignInFormMessages {
  /** Shown when the email field is not an email address. */
  invalidEmail: string;
  /** Shown when the password field is empty. */
  passwordRequired: string;
}

export type SignInMutationResult =
  undefined | { message: "access_denied" | "Internal Server Error" };

/** What the form renders after a failed attempt, or nothing at all. */
export type SignInFormError = "" | "access_denied";

export const createSignInFormSchema = ({
  invalidEmail,
  passwordRequired,
}: SignInFormMessages) =>
  z.object({
    email: z.email({ message: invalidEmail }).default(""),
    password: z.string().min(1, { message: passwordRequired }).default(""),
  });

export type SignInFormSchema = ReturnType<typeof createSignInFormSchema>;
export type SignInFormValues = z.infer<SignInFormSchema>;

export const signInFormOutcome = (
  result: SignInMutationResult,
): null | { error: SignInFormError; kind: "field" } | { kind: "toast" } => {
  if (!result?.message) return null;

  return result.message === "Internal Server Error"
    ? { kind: "toast" }
    : { error: result.message, kind: "field" };
};
