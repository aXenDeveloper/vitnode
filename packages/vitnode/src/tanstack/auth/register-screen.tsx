"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { SignUpFormContent } from "@/views/auth/sign-up/form/sign-up-form-content";
import { SignUpContent } from "@/views/auth/sign-up/sign-up-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";

import type { AuthNavigate } from "./actions";

import { RouteMessages } from "../i18n/route-messages";
import { startSsoAction, useSignUpAction } from "./actions";
import {
  middlewareConfigQueryOptions,
  ssoProvidersOf,
} from "./middleware-config";
import { postAuthDestination } from "./redirects";
import { REGISTER_NAMESPACES } from "./register-route";

export interface RegisterRouteProps {
  LinkComponent: AuthLinkComponent;
  navigate: AuthNavigate;
}

export const RegisterRouteContent = ({
  LinkComponent,
  navigate,
}: RegisterRouteProps) => {
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions());
  const signUp = useSignUpAction({
    destination: () => postAuthDestination(undefined),
    navigate,
  });

  return (
    <RouteMessages namespaces={REGISTER_NAMESPACES}>
      <SignUpContent
        form={
          <SignUpFormContent
            captcha={config.captcha}
            isEmail={config.isEmail}
            LinkComponent={LinkComponent}
            onSignUp={signUp}
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
