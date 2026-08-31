import type { ChangePasswordMutationResult } from "@/views/auth/password-reset/change-password-form/schema";
import type { PasswordResetMutationResult } from "@/views/auth/password-reset/form/schema";
import type { SignInMutationResult } from "@/views/auth/sign-in/form/schema";
import type { SignUpMutationResult } from "@/views/auth/sign-up/form/schema";
import type { SSOStartResult as SsoButtonFeedback } from "@/views/auth/sso/buttons/sso-buttons-content";
import type { SSOCallbackResult } from "@/views/auth/sso/callback/sso-callback-result";

import type {
  ChangePasswordResult,
  CompleteSsoResult,
  PasswordResetRequestResult,
  SignInResult,
  SignUpResult,
  SsoStartResult,
} from "./contract";
import type { SessionApi } from "./session-api";

/**
 * The auth contract, in the vocabulary the shared screens speak.
 *
 *     ./contract                 @vitnode/core/views/auth
 *     { ok: false, reason }  ->  { message } | { failure }
 *
 * Two vocabularies exist on purpose and neither is wrong. The contract is a
 * closed union over what the API can answer, with the distinctions the API makes
 * kept (`invalid_state` is not `unknown_provider`); the screens speak the legacy
 * shape they were extracted from, and are rendered unchanged by both frameworks.
 * Something has to translate, and it happens once, at the call site. This is
 * that call site, pulled out of the hooks so it is a set of
 * total functions over finite unions - checkable exhaustively, with no server,
 * no router and no React.
 *
 * Every collapse below loses information deliberately. A visitor cannot act on
 * the difference between "the OAuth state expired" and "that provider is not
 * configured": both mean start over, and the screen for both is the same. The
 * distinction survives where it is useful - in a server log - because nothing
 * here throws it away before `./server` has recorded it.
 */

/**
 * A sign-in attempt, as `SignInFormContent` reads it.
 *
 * `undefined` is success: the shared form treats "nothing to report" as "the
 * caller is navigating", which is exactly what the sign-in action then does.
 * `access_denied` becomes the alert above the fields; everything else becomes
 * the internal-error toast.
 */
export const signInFormResult = (
  result: SignInResult,
): SignInMutationResult => {
  if (result.ok) return undefined;

  return result.reason === "access_denied"
    ? { message: "access_denied" }
    : { message: "Internal Server Error" };
};

/**
 * Starting an SSO flow, as `SSOButtonsContent` reads it.
 *
 * A message means the row raises the internal-error toast. Success returns
 * nothing *here* because the caller has a browser to send somewhere - the
 * provider's authorization URL - and that is not a value the button row can do
 * anything with.
 *
 * The reason travels as the message even though the row does not print it: the
 * row renders one fixed sentence, so the string is only ever read in a
 * devtools network panel, and `unknown_provider` there is worth having.
 */
export const ssoStartFeedback = (result: SsoStartResult): SsoButtonFeedback =>
  result.ok ? undefined : { message: result.reason };

/**
 * Finishing an SSO round trip, as `useSSOCallback` reads it.
 *
 * `email_exists` is the one outcome with a screen of its own - the provider's
 * address already belongs to an account, and the visitor is offered the password
 * login instead. Everything else is one `unknown`, which is the shared
 * component's entire remaining vocabulary.
 */
export const ssoCallbackResult = (
  result: CompleteSsoResult,
): SSOCallbackResult => {
  if (result.ok) return {};

  return result.reason === "email_exists"
    ? { failure: "email_exists" }
    : { failure: "unknown" };
};

/**
 * The session a signed-out visitor has.
 *
 * Written from the session already in hand rather than invented, so everything
 * about the *installation* - which AI models are configured, and whatever else
 * the session route grows - survives the sign-out, and only the visitor is
 * removed. Building `{ ai: { models: [] }, user: null }` here instead would be a
 * second, quietly diverging definition of the anonymous session.
 *
 * The point is the frame between "the API said it worked" and "the refetch came
 * back": without this write that frame still renders the previous visitor's
 * name.
 */
export const anonymousSession = (session: SessionApi): SessionApi => ({
  ...session,
  user: null,
});

/**
 * A registration attempt, as `SignUpFormContent` reads it.
 *
 * The two vocabularies line up almost exactly, and where they do not it is
 * because the contract knows more than the screen can use:
 *
 *     ok, emailVerified: true    undefined              the caller is navigating
 *     ok, emailVerified: false   { emailConfirmation }  "check your email"
 *     email_exists               { message }            marks the email field
 *     name_exists                { message }            marks the username field
 *     conflict, invalid,         { message: 'Internal   the internal-error toast
 *     rate_limited, server_error   Server Error' }
 *
 * The last row is where information is deliberately lost. `conflict` is a `409`
 * whose field could not be identified, `invalid` is the API refusing the body or
 * the captcha, and `rate_limited` is the limiter - and the registration form has
 * one thing to say about all three, because a visitor cannot act on any of them
 * differently. The distinctions survive where they are useful, in the server log
 * `./server` writes.
 *
 * **`undefined` is only correct once the caller has actually navigated.** The
 * shared form treats "nothing to report" as "we are leaving", so a caller that
 * maps a verified sign-up to `undefined` and then does not move the router leaves
 * a form that appears to have done nothing. `useSignUpAction` refreshes the
 * session and navigates before it returns, which is what makes this row true.
 */
export const signUpFormResult = (
  result: SignUpResult,
): SignUpMutationResult => {
  if (result.ok) {
    return result.emailVerified
      ? undefined
      : { emailConfirmation: result.email };
  }

  if (result.reason === "email_exists") return { message: "email_exists" };
  if (result.reason === "name_exists") return { message: "name_exists" };

  return { message: "Internal Server Error" };
};

/**
 * A reset request, as `PasswordResetFormContent` reads it.
 *
 * `undefined` is "accepted", and it is what an existing address and a
 * non-existent one both produce - the API answers the same `201` for either, and
 * this mapping has no shape in which the difference could be expressed. That is
 * the anti-enumeration property, preserved by having nothing to preserve it
 * from.
 *
 * Every failure is the one toast: `invalid` (a captcha the API refused),
 * `rate_limited` and `server_error` all mean "we did not manage to send it", and
 * the form stays where it is so the visitor can try again.
 */
export const passwordResetFormResult = (
  result: PasswordResetRequestResult,
): PasswordResetMutationResult =>
  result.ok ? undefined : { message: "Internal Server Error" };

/**
 * A password change, as `ChangePasswordFormContent` reads it.
 *
 * `invalid_token` is the one failure that survives as itself, because it is the
 * one a visitor can act on: the link was wrong, already used, or older than
 * thirty minutes, and the answer is to ask for a fresh one. The shared form
 * renders it with the `400` copy rather than the generic internal-error copy for
 * exactly that reason.
 */
export const changePasswordFormResult = (
  result: ChangePasswordResult,
): ChangePasswordMutationResult => {
  if (result.ok) return undefined;

  return {
    message:
      result.reason === "invalid_token"
        ? "invalid_token"
        : "internal_server_error",
  };
};
