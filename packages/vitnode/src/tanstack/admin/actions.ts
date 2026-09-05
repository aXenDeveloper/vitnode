import { useQueryClient } from "@tanstack/react-query";

import type { SignInSubmit } from "@/views/auth/sign-in/form/sign-in-form-content";

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
