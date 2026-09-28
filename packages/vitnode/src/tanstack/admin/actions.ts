import { useQueryClient } from "@tanstack/react-query";

import type { SignInSubmit } from "@/views/auth/sign-in/form/sign-in-form-content";
import type { PasskeySignInSubmit } from "@/views/auth/sign-in/passkey/passkey-sign-in-button";

import { getPasskeyInBrowser } from "@/views/auth/passkeys/webauthn";

import type { AuthNavigate } from "../auth/actions";

import { signInFormResult } from "../auth/screens";
import { authTransport } from "../auth/transport";
import { removeAdminIdentityQueries } from "./queries";

export const useAdminSignInAction = ({
  destination,
  navigate,
}: {
  destination: () => string;
  navigate: AuthNavigate;
}): SignInSubmit => {
  const queryClient = useQueryClient();

  return async values => {
    const result = await authTransport().signIn({ ...values, isAdmin: true });

    if (!result.ok) return signInFormResult(result);

    removeAdminIdentityQueries(queryClient);
    await navigate(destination());

    return undefined;
  };
};

export const useAdminPasskeySignInAction = ({
  destination,
  navigate,
}: {
  destination: () => string;
  navigate: AuthNavigate;
}): PasskeySignInSubmit => {
  const queryClient = useQueryClient();

  return async () => {
    const start = await authTransport().startAdminPasskeySignIn();
    if (!start.ok) return start.reason;

    const ceremony = await getPasskeyInBrowser(start.options);
    if (!ceremony.ok) {
      return ceremony.failure === "already_registered"
        ? "failed"
        : ceremony.failure;
    }

    const result = await authTransport().finishAdminPasskeySignIn({
      response: ceremony.response,
    });

    if (!result.ok) {
      return result.reason === "access_denied" ? "rejected" : result.reason;
    }

    removeAdminIdentityQueries(queryClient);
    await navigate(destination());

    return undefined;
  };
};
