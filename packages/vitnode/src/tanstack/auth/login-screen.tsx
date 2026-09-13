import { SignInFormContent } from "@/views/auth/sign-in/form/sign-in-form-content";
import { SignInContent } from "@/views/auth/sign-in/sign-in-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";

import type { AuthNavigate } from "./actions";

import { RouteMessages } from "../i18n/route-messages";
import { startSsoAction, useSignInAction } from "./actions";
import { LOGIN_NAMESPACES } from "./login-route";
import { ssoProvidersOf, useMiddlewareConfigQuery } from "./middleware-config";
import { postAuthDestination } from "./redirects";

export interface LoginRouteProps {
  navigate: AuthNavigate;
  /** Where the visitor was heading before a guard sent them here. */
  returnTo?: string;
}

export const LoginRouteContent = ({ navigate, returnTo }: LoginRouteProps) => {
  const { data: config } = useMiddlewareConfigQuery();
  const signIn = useSignInAction({
    destination: () => postAuthDestination(returnTo),
    navigate,
  });

  return (
    <RouteMessages namespaces={LOGIN_NAMESPACES}>
      <SignInContent
        form={
          <SignInFormContent
            onSignIn={signIn}
            showResetPassword={config.isEmail}
          />
        }
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
