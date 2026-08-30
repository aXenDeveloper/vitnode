"use client";

import { SignInAdminContent } from "@/views/admin/sign-in/sign-in-admin-content";
import { SignInFormContent } from "@/views/auth/sign-in/form/sign-in-form-content";

import type { AuthNavigate } from "../auth/actions";

import { RouteMessages } from "../i18n/route-messages";
import { useAdminSignInAction } from "./actions";
import { sanitizeAdminReturnTo } from "./return-to";
import { ADMIN_SIGN_IN_NAMESPACES } from "./sign-in-route";

export interface AdminSignInRouteProps {
  /**
   * How a finished sign-in moves. During the migration a host passes one that
   * asks its route tree whether it serves the destination, so `/admin/core`
   * is a document load into the Next.js AdminCP until that route lands here.
   */
  navigate: AuthNavigate;
  /** Where the administrator was heading before the guard sent them here. */
  returnTo?: string;
}

/**
 * The AdminCP sign-in page.
 *
 * The card, the logo and the form are shared with the Next.js screen; the action
 * is `useAdminSignInAction`, which signs in against the admin session and drops
 * the cached one before it navigates.
 *
 * `sanitizeAdminReturnTo` is applied *here*, where the value is used, rather
 * than in the route's `validateSearch`. The search contract keeps whatever
 * arrived and judges nothing - the same split `/login` uses - so there is one
 * place that decides whether a target is somewhere this app may send a browser,
 * and it is the place that hands it to a navigation.
 *
 * A thunk rather than a computed value, so the destination is read at submit
 * time: `?returnTo=` can change under a mounted form.
 */
export const AdminSignInRouteContent = ({
  navigate,
  returnTo,
}: AdminSignInRouteProps) => {
  const signIn = useAdminSignInAction({
    destination: () => sanitizeAdminReturnTo(returnTo),
    navigate,
  });

  return (
    <RouteMessages namespaces={ADMIN_SIGN_IN_NAMESPACES}>
      <main>
        <SignInAdminContent form={<SignInFormContent onSignIn={signIn} />} />
      </main>
    </RouteMessages>
  );
};
