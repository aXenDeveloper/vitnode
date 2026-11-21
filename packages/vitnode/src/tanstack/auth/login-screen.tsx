import { useRouter } from "@tanstack/react-router";
import React from "react";

import type { HeldSignIn } from "@/views/auth/sign-in/deletion-hold/schema";

import {
  ssoProviderOfMethod,
  useLastSignInMethod,
} from "@/views/auth/last-sign-in-method";
import { AccountDeletionHoldDialog } from "@/views/auth/sign-in/deletion-hold/account-deletion-hold-dialog";
import { SignInFormContent } from "@/views/auth/sign-in/form/sign-in-form-content";
import { PasskeySignInButton } from "@/views/auth/sign-in/passkey/passkey-sign-in-button";
import { SignInContent } from "@/views/auth/sign-in/sign-in-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";

import { RouteMessages } from "../i18n/route-messages";
import {
  requestPasswordResetAction,
  startSsoAction,
  useCancelDeletionSignInAction,
  usePasskeySignInAction,
  useSignInAction,
} from "./actions";
import { LOGIN_NAMESPACES } from "./login-route";
import {
  authMethodsOf,
  hasSignInMethod,
  useMiddlewareConfigQuery,
} from "./middleware-config";
import { internalDestination } from "./navigation";
import { postAuthDestination } from "./redirects";

export interface LoginRouteProps {
  /** Where the visitor was heading before a guard sent them here. */
  returnTo?: string;
}

export const LoginRouteContent = ({ returnTo }: LoginRouteProps) => {
  const { data: config } = useMiddlewareConfigQuery();
  const methods = authMethodsOf(config);
  const lastMethod = useLastSignInMethod();
  const router = useRouter();
  const [hold, setHold] = React.useState<HeldSignIn | null>(null);
  const signIn = useSignInAction({
    destination: () => postAuthDestination(returnTo),
    onDeletionHold: setHold,
  });
  const passkeySignIn = usePasskeySignInAction({
    destination: () => postAuthDestination(returnTo),
    onDeletionHold: setHold,
  });
  const cancelDeletionSignIn = useCancelDeletionSignInAction({
    onSignedIn: async () => {
      await router.navigate(internalDestination(postAuthDestination(returnTo)));
    },
  });

  return (
    <RouteMessages namespaces={LOGIN_NAMESPACES}>
      <AccountDeletionHoldDialog
        hold={hold}
        onConfirm={cancelDeletionSignIn}
        onKeep={() => {
          setHold(null);
        }}
      />
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
