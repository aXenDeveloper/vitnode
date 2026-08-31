import { z } from "zod";

/**
 * The "send me a reset link" form's shape and its failure vocabulary, with no
 * React in sight.
 *
 * One field and two outcomes, so this is a small module - but it is the same
 * split the sign-in and sign-up forms make, and it is what lets the interesting
 * half be checked without a renderer or a request.
 */

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

/**
 * What the API told us about a reset request.
 *
 * `undefined` means accepted - and *only* that. The API deliberately answers
 * `201` whether or not the address belongs to an account, and whether or not it
 * decided to skip the send because one was already requested in the last five
 * minutes (`users/routes/reset-passowrd.route.ts`). That is the product's
 * anti-enumeration behaviour, so this type has no shape in which "no such
 * account" could be expressed: there is nothing to report but "we have taken
 * your request".
 *
 * `{ message: 'Internal Server Error' }` is a request that did not reach that
 * point at all - the transport failed, the rate limiter refused it, the API
 * errored - and the screen raises the internal-error toast rather than claiming
 * an email is on its way.
 */
export type PasswordResetMutationResult =
  undefined | { message: "Internal Server Error" };

/**
 * What a submit result means for the screen.
 *
 * - `"confirmation"` - swap the card for "check your email", printing the
 *   address the visitor typed. Reached for *every* accepted request, which is
 *   exactly why it reveals nothing.
 * - `"toast"` - the internal-error toast; the form stays as it is so the visitor
 *   can try again.
 */
export const passwordResetFormOutcome = (
  result: PasswordResetMutationResult,
): { kind: "confirmation" } | { kind: "toast" } =>
  result?.message ? { kind: "toast" } : { kind: "confirmation" };
