import { SignInAdminContent } from "@/views/admin/sign-in/sign-in-admin-content";
import { SignInFormContent } from "@/views/auth/sign-in/form/sign-in-form-content";
import { PasskeySignInButton } from "@/views/auth/sign-in/passkey/passkey-sign-in-button";

import { useMiddlewareConfigQuery } from "../auth/middleware-config";
import { RouteMessages } from "../i18n/route-messages";
import { useAdminPasskeySignInAction, useAdminSignInAction } from "./actions";
import { sanitizeAdminReturnTo } from "./return-to";
import { ADMIN_SIGN_IN_NAMESPACES } from "./sign-in-route";

export interface AdminSignInRouteProps {
  /** Where the administrator was heading before the guard sent them here. */
  returnTo?: string;
}

export const AdminSignInRouteContent = ({
  returnTo,
}: AdminSignInRouteProps) => {
  const { data: config } = useMiddlewareConfigQuery();
  const destination = () => sanitizeAdminReturnTo(returnTo);
  const signIn = useAdminSignInAction({ destination });
  const passkeySignIn = useAdminPasskeySignInAction({ destination });

  return (
    <RouteMessages namespaces={ADMIN_SIGN_IN_NAMESPACES}>
      <main>
        <SignInAdminContent
          form={<SignInFormContent onSignIn={signIn} />}
          passkey={
            config.passkeys ? (
              <PasskeySignInButton onSignIn={passkeySignIn} />
            ) : undefined
          }
        />
      </main>
    </RouteMessages>
  );
};
