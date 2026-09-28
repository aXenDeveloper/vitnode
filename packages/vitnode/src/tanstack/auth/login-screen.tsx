import { SignInFormContent } from "@/views/auth/sign-in/form/sign-in-form-content";
import { PasskeySignInButton } from "@/views/auth/sign-in/passkey/passkey-sign-in-button";
import { SignInContent } from "@/views/auth/sign-in/sign-in-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";

import type { AuthNavigate } from "./actions";

import { RouteMessages } from "../i18n/route-messages";
import {
  startSsoAction,
  usePasskeySignInAction,
  useSignInAction,
} from "./actions";
import { LOGIN_NAMESPACES } from "./login-route";
import {
  authMethodsOf,
  hasSignInMethod,
  useMiddlewareConfigQuery,
} from "./middleware-config";
import { postAuthDestination } from "./redirects";

export interface LoginRouteProps {
  navigate: AuthNavigate;
  /** Where the visitor was heading before a guard sent them here. */
  returnTo?: string;
}

export const LoginRouteContent = ({ navigate, returnTo }: LoginRouteProps) => {
  const { data: config } = useMiddlewareConfigQuery();
  const methods = authMethodsOf(config);
  const signIn = useSignInAction({
    destination: () => postAuthDestination(returnTo),
    navigate,
  });
  const passkeySignIn = usePasskeySignInAction({
    destination: () => postAuthDestination(returnTo),
    navigate,
  });

  return (
    <RouteMessages namespaces={LOGIN_NAMESPACES}>
      <SignInContent
        form={
          methods.password ? (
            <SignInFormContent
              onSignIn={signIn}
              showResetPassword={methods.resetPassword}
            />
          ) : undefined
        }
        isUnavailable={!hasSignInMethod(methods)}
        passkey={
          methods.passkey ? (
            <PasskeySignInButton
              onSignIn={passkeySignIn}
              showDivider={methods.password || methods.sso.length > 0}
            />
          ) : undefined
        }
        showSignUp={methods.signUp}
        sso={
          <SSOButtonsContent
            onSelectProvider={startSsoAction}
            providers={methods.sso}
            showDivider={methods.password}
          />
        }
      />
    </RouteMessages>
  );
};
