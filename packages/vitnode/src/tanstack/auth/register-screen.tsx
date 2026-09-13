import { SignUpFormContent } from "@/views/auth/sign-up/form/sign-up-form-content";
import { SignUpContent } from "@/views/auth/sign-up/sign-up-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";

import type { AuthNavigate } from "./actions";

import { RouteMessages } from "../i18n/route-messages";
import { startSsoAction, useSignUpAction } from "./actions";
import { ssoProvidersOf, useMiddlewareConfigQuery } from "./middleware-config";
import { postAuthDestination } from "./redirects";
import { REGISTER_NAMESPACES } from "./register-route";

export interface RegisterRouteProps {
  navigate: AuthNavigate;
}

export const RegisterRouteContent = ({ navigate }: RegisterRouteProps) => {
  const { data: config } = useMiddlewareConfigQuery();
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
            onSignUp={signUp}
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
