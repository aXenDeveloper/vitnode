import { SignUpFormContent } from "@/views/auth/sign-up/form/sign-up-form-content";
import { SignUpContent } from "@/views/auth/sign-up/sign-up-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";

import { RouteMessages } from "../i18n/route-messages";
import { startSsoAction, useSignUpAction } from "./actions";
import { authMethodsOf, useMiddlewareConfigQuery } from "./middleware-config";
import { postAuthDestination } from "./redirects";
import { REGISTER_NAMESPACES } from "./register-route";

export const RegisterRouteContent = () => {
  const { data: config } = useMiddlewareConfigQuery();
  const methods = authMethodsOf(config);
  const signUp = useSignUpAction({
    destination: () => postAuthDestination(undefined),
  });

  return (
    <RouteMessages namespaces={REGISTER_NAMESPACES}>
      <SignUpContent
        form={
          methods.password ? (
            <SignUpFormContent
              captcha={config.captcha}
              isEmail={config.isEmail}
              onSignUp={signUp}
            />
          ) : undefined
        }
        isUnavailable={!methods.signUp}
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
