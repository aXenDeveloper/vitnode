import {
  ssoProviderOfMethod,
  useLastSignInMethod,
} from "@/views/auth/last-sign-in-method";
import { SignInFormContent } from "@/views/auth/sign-in/form/sign-in-form-content";
import { PasskeySignInButton } from "@/views/auth/sign-in/passkey/passkey-sign-in-button";
import { SignInContent } from "@/views/auth/sign-in/sign-in-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";

import { RouteMessages } from "../i18n/route-messages";
import {
  requestPasswordResetAction,
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
  /** Where the visitor was heading before a guard sent them here. */
  returnTo?: string;
}

export const LoginRouteContent = ({ returnTo }: LoginRouteProps) => {
  const { data: config } = useMiddlewareConfigQuery();
  const methods = authMethodsOf(config);
  const lastMethod = useLastSignInMethod();
  const signIn = useSignInAction({
    destination: () => postAuthDestination(returnTo),
  });
  const passkeySignIn = usePasskeySignInAction({
    destination: () => postAuthDestination(returnTo),
  });

  return (
    <RouteMessages namespaces={LOGIN_NAMESPACES}>
      <SignInContent
        form={
          methods.password ? (
            <SignInFormContent
              captcha={config.captcha}
              onRequestReset={requestPasswordResetAction}
              onSignIn={signIn}
              showResetPassword={methods.resetPassword}
            />
          ) : undefined
        }
        isUnavailable={!hasSignInMethod(methods)}
        passkey={
          methods.passkey ? (
            <PasskeySignInButton
              isLastUsed={lastMethod === "passkey"}
              onSignIn={passkeySignIn}
              showDivider={false}
            />
          ) : undefined
        }
        showSignUp={methods.signUp}
        sso={
          methods.sso.length > 0 ? (
            <SSOButtonsContent
              lastUsedProviderId={ssoProviderOfMethod(lastMethod)}
              onSelectProvider={startSsoAction}
              providers={methods.sso}
            />
          ) : undefined
        }
      />
    </RouteMessages>
  );
};
