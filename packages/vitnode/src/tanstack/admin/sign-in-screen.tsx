"use client";

import { SignInAdminContent } from "@/views/admin/sign-in/sign-in-admin-content";
import { SignInFormContent } from "@/views/auth/sign-in/form/sign-in-form-content";

import type { AuthNavigate } from "../auth/actions";

import { RouteMessages } from "../i18n/route-messages";
import { useAdminSignInAction } from "./actions";
import { sanitizeAdminReturnTo } from "./return-to";
import { ADMIN_SIGN_IN_NAMESPACES } from "./sign-in-route";

export interface AdminSignInRouteProps {
  navigate: AuthNavigate;
  /** Where the administrator was heading before the guard sent them here. */
  returnTo?: string;
}

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
