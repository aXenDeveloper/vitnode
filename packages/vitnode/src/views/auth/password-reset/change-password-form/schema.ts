import { z } from "zod";

import type { PasswordFieldMessages } from "../../sign-up/form/schema";
import type { RecoveryLink } from "../recovery-link";

import { createPasswordZodSchema } from "../../sign-up/form/schema";

/**
 * The "choose a new password" form's shape and its failure vocabulary, with no
 * React in sight.
 *
 * The password rules are *imported* rather than restated. They are the
 * registration form's rules - one function of two translated strings in
 * `sign-up/form/schema.ts` - and a second copy here would be a second answer to
 * "what is a strong enough password", which is precisely the kind of pair that
 * drifts.
 */

export type ChangePasswordFormMessages = PasswordFieldMessages;

export const createChangePasswordFormSchema = (
  messages: ChangePasswordFormMessages,
) =>
  z.object({
    password: createPasswordZodSchema(messages),
  });

export type ChangePasswordFormSchema = ReturnType<
  typeof createChangePasswordFormSchema
>;
export type ChangePasswordFormValues = z.infer<ChangePasswordFormSchema>;

/**
 * What the form sends: the new password, plus the link it is acting on.
 *
 * The link travels as a {@link RecoveryLink} - already parsed, `userId` already
 * a number - rather than as the raw search parameters, so a screen cannot hand
 * the transport a `userId` of `"abc"` and no layer has to coerce one. See
 * `../recovery-link.ts`.
 */
export type ChangePasswordSubmitValues = RecoveryLink & { password: string };

/**
 * What the API told us about a password change.
 *
 * `undefined` is success. `'invalid_token'` is the API's `400`: the row it looks
 * up by `userId` + `token` + an unexpired `expiresAt` was not there, which means
 * the link was wrong, already used, or older than thirty minutes. It is kept
 * apart from the generic failure because it is the one a visitor can act on -
 * ask for a fresh link - whereas a `500` is nothing they can do anything about.
 *
 * The API's own message (`"Invalid token"`) never travels; only this literal
 * does.
 */
export type ChangePasswordMutationResult =
  undefined | { message: "internal_server_error" | "invalid_token" };

/**
 * What a submit result means for the screen.
 *
 * - `"success"` - raise the success toast and leave for the login page. The API
 *   does *not* sign the visitor in (`users/routes/change-password.route.ts`
 *   mints no session), so the next step is genuinely to log in.
 * - `"toast"` - a failure toast, with `reason` deciding which message. The form
 *   stays where it is either way.
 */
export const changePasswordFormOutcome = (
  result: ChangePasswordMutationResult,
):
  | { kind: "success" }
  | { kind: "toast"; reason: "invalid_token" | "server" } =>
  result?.message
    ? {
        kind: "toast",
        reason: result.message === "invalid_token" ? "invalid_token" : "server",
      }
    : { kind: "success" };
