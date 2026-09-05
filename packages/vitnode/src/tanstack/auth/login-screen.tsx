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

  navigate: AuthNavigate;
  /** Where the visitor was heading before a guard sent them here. */
  returnTo?: string;
}

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
    </RouteMessages>
  );
};
