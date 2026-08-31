import { z } from "zod";

/**
 * The sign-in form's shape and its failure vocabulary, with no React in sight.
 *
 * Pulled out of the hook so both halves are testable as what they are: the
 * schema is a function of two already-translated strings, and the error mapping
 * is a function of whatever the submit callback returned. Neither needs a
 * renderer, a provider or a request to be checked.
 */

export interface SignInFormMessages {
  /** Shown when the email field is not an email address. */
  invalidEmail: string;
  /** Shown when the password field is empty. */
  passwordRequired: string;
}

/**
 * The API's answer to a sign-in attempt, as the UI cares about it.
 *
 * `access_denied` is the one failure with a screen of its own; anything else is
 * a server problem the visitor cannot act on. Kept as the literals the route
 * already returns so a wrapper stays a thin translation of a status code.
 */
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

/**
 * What a submit result means for the screen.
 *
 * - `"field"` - a failure the visitor can fix, rendered as the alert above the
 *   form. Only `access_denied` qualifies today.
 * - `"toast"` - a server error, rendered as the internal-error toast.
 * - `null` - nothing to show: either the sign-in worked, or the caller
 *   navigated away and never returned a result at all.
 *
 * A success is deliberately indistinguishable from "returned nothing". Both the
 * Next.js server action and a TanStack Start mutation redirect on success, so
 * the resolved value on the happy path is `undefined` in both - which is why
 * the type says `undefined` rather than `void`: a callback with nothing to
 * report has to say so, and an `async` function that only ever returns a
 * failure already infers exactly this.
 */
export const signInFormOutcome = (
  result: SignInMutationResult,
): null | { error: SignInFormError; kind: "field" } | { kind: "toast" } => {
  if (!result?.message) return null;

  return result.message === "Internal Server Error"
    ? { kind: "toast" }
    : { error: result.message, kind: "field" };
};
