"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { SignInFormContent } from "@/views/auth/sign-in/form/sign-in-form-content";
import { SignInContent } from "@/views/auth/sign-in/sign-in-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";

import type { AuthNavigate } from "./actions";

import { RouteMessages } from "../i18n/route-messages";
import { startSsoAction, useSignInAction } from "./actions";
import { LOGIN_NAMESPACES } from "./login-route";
import {
  middlewareConfigQueryOptions,
  ssoProvidersOf,
} from "./middleware-config";
import { postAuthDestination } from "./redirects";

export interface LoginRouteProps {
  LinkComponent: AuthLinkComponent;
  /**
   * How a finished sign-in moves. During the migration a host passes one that
   * asks its route tree whether it serves the destination, so `/discover` is a
   * client-side navigation and `/settings/security?tab=devices` is a document
   * load into the application that still serves it.
   */
  navigate: AuthNavigate;
  /** Where the visitor was heading before a guard sent them here. */
  returnTo?: string;
}

/**
 * The login page, as everything below a route file's `component`.
 *
 * This screen deliberately ignores `config.isKnown`: a failed read degrades to
 * no provider row and no reset-password link, and the email and password fields
 * - which are the whole of signing in on most installs - still render. Making
 * the login page unavailable because an optional read failed would be a far
 * larger outage than the one that caused it.
 */
export const LoginRouteContent = ({
  LinkComponent,
  navigate,
  returnTo,
}: LoginRouteProps) => {
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions());
  const signIn = useSignInAction({
    destination: () => postAuthDestination(returnTo),
    navigate,
  });

  return (
    <RouteMessages namespaces={LOGIN_NAMESPACES}>
      <main>
        <SignInContent
          form={
            <SignInFormContent
              LinkComponent={LinkComponent}
              onSignIn={signIn}
              showResetPassword={config.isEmail}
            />
          }
          LinkComponent={LinkComponent}
          sso={
            <SSOButtonsContent
              onSelectProvider={startSsoAction}
              providers={ssoProvidersOf(config)}
            />
          }
        />
      </main>
    </RouteMessages>
  );
};
