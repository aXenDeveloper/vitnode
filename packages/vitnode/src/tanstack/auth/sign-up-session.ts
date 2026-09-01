import type { SignUpResult } from "./contract";

/**
 * Whether registration produced a session the canonical session query has to go
 * and read.
 *
 * The one decision that connects sign-up to the rest of the app, written as a
 * function so it is stated once and tested without a browser.
 *
 * `true` only for a successful sign-up with `emailVerified`. That is precisely
 * when the API called `createSessionByUserId` on the same request, which means
 * the `201` carried a `Set-Cookie`, which means `saveApiCookies` put it on the
 * response the browser is reading - so the *next* read of `/users/session`
 * answers with the new visitor and the cached one is stale.
 *
 * `false` for an unverified account, and that matters more than it looks:
 * inventing a refresh there would replace a known-anonymous session with another
 * known-anonymous session and, worse, invite a caller to navigate as though the
 * visitor were signed in. They are not - the account is waiting on a
 * confirmation link the API does not send yet (`// TODO: Send verification
 * email`), and the screen for that is the confirmation view.
 *
 * There is deliberately no equivalent for the two recovery mutations: neither
 * mints a session, so neither has a session to refresh.
 *
 * ## Why it is not in `./contract` beside the union it reads
 *
 * Because `./contract` imports `zod`, and this is the only value `./actions`
 * takes from it - everything else it needs from there is a type, which is
 * erased. `./actions` is on the *public shell's* path: the header's user menu
 * signs a visitor out, so a page with a header reaches this module, and through
 * it reached every mutation input schema the auth contract declares. Measured on
 * vitnode.com's front page, that edge alone put `zod` in the initial graph.
 *
 * The type import above costs nothing - `verbatimModuleSyntax` erases it before
 * a bundler sees it - and `./contract` re-exports this function, so nothing that
 * imported it from there has to move.
 */
export const shouldRefreshSessionAfterSignUp = (
  result: SignUpResult,
): boolean => result.ok && result.emailVerified;
