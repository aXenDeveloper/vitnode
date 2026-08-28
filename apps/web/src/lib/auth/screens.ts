import type { SignInMutationResult } from '@vitnode/core/views/auth/sign-in/form/schema'
import type { SSOStartResult as SsoButtonFeedback } from '@vitnode/core/views/auth/sso/buttons/sso-buttons-content'
import type { SSOCallbackResult } from '@vitnode/core/views/auth/sso/callback/sso-callback-result'

import type {
  CompleteSsoResult,
  SignInResult,
  SsoStartResult,
} from '#/lib/auth/contract'
import type { SessionApi } from '#/lib/session'

/**
 * The auth contract, in the vocabulary the shared screens speak.
 *
 *     #/lib/auth/contract        @vitnode/core/views/auth
 *     { ok: false, reason }  ->  { message } | { failure }
 *
 * Two vocabularies exist on purpose and neither is wrong. The contract is a
 * closed union over what the API can answer, with the distinctions the API makes
 * kept (`invalid_state` is not `unknown_provider`); the screens speak the legacy
 * shape they were extracted from, and are rendered unchanged by both frameworks.
 * Something has to translate, and Agent A's contract says where: once, at the
 * call site. This is that call site, pulled out of the hooks so it is a set of
 * total functions over finite unions - checkable exhaustively, with no server,
 * no router and no React.
 *
 * Every collapse below loses information deliberately. A visitor cannot act on
 * the difference between "the OAuth state expired" and "that provider is not
 * configured": both mean start over, and the screen for both is the same. The
 * distinction survives where it is useful - in a server log - because nothing
 * here throws it away before `#/server/auth.server` has recorded it.
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
  if (result.ok) return undefined

  return result.reason === 'access_denied'
    ? { message: 'access_denied' }
    : { message: 'Internal Server Error' }
}

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
  result.ok ? undefined : { message: result.reason }

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
  if (result.ok) return {}

  return result.reason === 'email_exists'
    ? { failure: 'email_exists' }
    : { failure: 'unknown' }
}

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
})
