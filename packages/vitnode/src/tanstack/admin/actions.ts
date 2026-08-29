import { useQueryClient } from "@tanstack/react-query";

import type { SignInSubmit } from "@/views/auth/sign-in/form/sign-in-form-content";

import type { AuthNavigate } from "../auth/actions";

import { signInFormResult } from "../auth/screens";
import { authTransport } from "../auth/transport";
import { removeAdminIdentityQueries } from "./queries";

/**
 * Signing in to the AdminCP.
 *
 *     form  ->  authTransport().signIn({ ..., isAdmin: true })  ->  Hono
 *                       |                                            |
 *                       +->  drop everything privileged  <-  Set-Cookie
 *                       |
 *                       +->  navigate
 *
 * The mutation, the schema, the status mapping and the cookie copying are
 * `tanstack/auth`'s, unchanged and unduplicated: this is the same `signIn` the
 * public login page calls, with `isAdmin: true`, which is the same flag the
 * legacy server action passed through. There is no admin sign-in endpoint and no
 * second auth transport.
 *
 * What `isAdmin` changes on the API is worth being exact about, because it is
 * the reason this is a separate action rather than a parameter on the public
 * one:
 *
 *     isAdmin: false  ->  SessionModel.createSessionByUserId       public cookie
 *     isAdmin: true   ->  SessionAdminModel.createSessionByUserId  admin cookie
 *
 * They are exclusive branches in `sign-in.route.ts`. An admin sign-in therefore
 * mints *only* `vitnode_auth_admin` and leaves the public session exactly as it
 * was - which is why nothing here refreshes it. Invalidating the public session
 * would cost a round trip to learn that an answer this request could not have
 * changed has not changed.
 *
 * `SessionAdminModel.createSessionByUserId` also re-checks
 * `checkIfUserIsAdmin` and throws `403` for somebody who is not one, so a
 * visitor with valid credentials but no admin permission gets the same
 * `access_denied` alert as a wrong password. That is the API's decision and this
 * layer neither adds to it nor softens it.
 */

/**
 * The AdminCP sign-in, in the shape `SignInFormContent` submits.
 *
 * `undefined` on success, which is the shared form's way of saying "the caller
 * is navigating" - and it is, on the line below. On failure the form gets the
 * legacy vocabulary back through `signInFormResult` and renders the
 * access-denied alert or the internal-error toast itself, exactly as the public
 * card does.
 *
 * ## The cache is dropped before anything navigates
 *
 * `removeAdminIdentityQueries` rather than an invalidation, and before the
 * navigation rather than after it. Three halves, and the third is the one an
 * earlier draft of this action missed:
 *
 * - **Removal, not invalidation.** The browser may already hold a *different*
 *   administrator's answer - Admin A signed out in this tab and Admin B is
 *   signing in. Invalidating keeps A's permission set in the cache and marks it
 *   stale, so the shell would render A's sidebar until a refetch returned.
 *   Removing it leaves nothing to render from, so the next reader must ask the
 *   API, which reads the cookie the browser now holds.
 * - **Before the navigation.** The destination is under `_admin`, whose
 *   `beforeLoad` calls `ensureAdminAccess`. Dropping the entry first is what
 *   makes that guard perform a real read instead of deciding on whatever was
 *   there - and it is also why there is no explicit refetch here. One read, in
 *   the guard, is the whole point of there being one query definition.
 * - **The screens, not only the session.** A sign-in is an identity boundary,
 *   and A's session expiring or being revoked leaves no sign-out behind to have
 *   cleaned up after it. So every privileged AdminCP entry goes, not just the
 *   permission set: the palette's user lookups and every screen under
 *   `["vitnode","admin"]` - the file table, the cron list, the dashboard layout,
 *   which is administrator-specific and not keyed by identity. See
 *   `./queries`, which owns that list.
 *
 * `navigate` is the caller's, and during the migration that matters: part of
 * `/admin/*` is still served by the Next.js application - `/admin/content/*`
 * after Stage 12 - so `apps/web` passes a navigator that asks its own route tree
 * whether it serves the destination. A `?returnTo=` naming a migrated screen is
 * a client navigation and one naming a content screen is a document load, and
 * the answer changes on its own as later stages move routes. There is no list of
 * migrated admin routes here or anywhere else.
 *
 * `destination` is a thunk rather than a value for the same reason it is on the
 * login page: `?returnTo=` can change under the form, and reading it at submit
 * time rather than at mount time is what keeps the two in step.
 */
export const useAdminSignInAction = ({
  destination,
  navigate,
}: {
  destination: () => string;
  navigate: AuthNavigate;
}): SignInSubmit => {
  const queryClient = useQueryClient();

  return async values => {
    const result = await authTransport().signIn({ ...values, isAdmin: true });

    if (!result.ok) return signInFormResult(result);

    removeAdminIdentityQueries(queryClient);
    await navigate(destination());

    return undefined;
  };
};
