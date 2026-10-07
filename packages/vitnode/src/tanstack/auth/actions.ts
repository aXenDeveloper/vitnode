import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import type { ChangePasswordSubmit } from "@/views/auth/password-reset/change-password-form/change-password-form-content";
import type { PasswordResetSubmit } from "@/views/auth/password-reset/form/password-reset-form-content";
import type { SignInSubmit } from "@/views/auth/sign-in/form/sign-in-form-content";
import type { PasskeySignInSubmit } from "@/views/auth/sign-in/passkey/passkey-sign-in-button";
import type { SignUpSubmit } from "@/views/auth/sign-up/form/sign-up-form-content";
import type { SSOSelectProvider } from "@/views/auth/sso/buttons/sso-buttons-content";
import type { SSOCallbackResult } from "@/views/auth/sso/callback/sso-callback-result";
import type { SSOLinkSubmit } from "@/views/auth/sso/link/use-sso-link-form";
import type {
  ConfirmEmailSubmit,
  ResendVerificationSubmit,
} from "@/views/auth/verify-email/schema";

import { getPasskeyInBrowser } from "@/views/auth/passkeys/webauthn";

import type { SsoCallbackInput } from "./contract";

import { removeAdminIdentityQueries } from "../admin/queries";
import { internalDestination } from "./navigation";
import { removeUserIdentityQueries } from "./queries";
import {
  anonymousSession,
  changePasswordFormResult,
  confirmEmailResult,
  passwordResetFormResult,
  resendVerificationFormResult,
  signInFormResult,
  signUpFormResult,
  ssoCallbackResult,
  ssoLinkFormResult,
  ssoStartFeedback,
} from "./screens";
import {
  invalidateSession,
  sessionQueryOptions,
  setSessionData,
} from "./session-query";
import { shouldRefreshSessionAfterSignUp } from "./sign-up-session";
import { authTransport } from "./transport";

export const useSignInAction = ({
  destination,
}: {
  destination: () => string;
}): SignInSubmit => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async values => {
    const result = await authTransport().signIn(values);

    if (!result.ok) return signInFormResult(result);

    // Somebody has just identified themselves, and it may not be whoever this
    // browser held data for. Dropping it costs nothing when there is none -
    // which is the usual case on the public login page - and forces every
    // private answer to be re-derived from the cookie when there is. Both
    // halves: the AdminCP's privileged entries, and this visitor's own files
    // and devices. See the long note on `useSignOutAction`.
    removeAdminIdentityQueries(queryClient);
    removeUserIdentityQueries(queryClient);

    await invalidateSession(queryClient);
    await router.navigate(internalDestination(destination()));

    return undefined;
  };
};

export const usePasskeySignInAction = ({
  destination,
}: {
  destination: () => string;
}): PasskeySignInSubmit => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async () => {
    const start = await authTransport().startPasskeySignIn();
    if (!start.ok) return start.reason;

    const ceremony = await getPasskeyInBrowser(start.options);
    if (!ceremony.ok) {
      return ceremony.failure === "already_registered"
        ? "failed"
        : ceremony.failure;
    }

    const result = await authTransport().finishPasskeySignIn({
      response: ceremony.response,
    });

    if (!result.ok) {
      return result.reason === "access_denied" ? "rejected" : result.reason;
    }

    removeAdminIdentityQueries(queryClient);
    removeUserIdentityQueries(queryClient);

    await invalidateSession(queryClient);
    await router.navigate(internalDestination(destination()));

    return undefined;
  };
};

export const startSsoAction: SSOSelectProvider = async providerId => {
  const result = await authTransport().startSso({ providerId });

  if (!result.ok) return ssoStartFeedback(result);

  globalThis.location.assign(result.url);

  return undefined;
};

export const useCompleteSsoAction = (params: null | SsoCallbackInput) => {
  const queryClient = useQueryClient();

  return async (): Promise<SSOCallbackResult> => {
    if (!params) return { failure: "unknown" };

    const result = await authTransport().completeSso(params);

    if (result.ok) {
      // The same identity boundary the password sign-in above crosses, reached
      // by a different door: a provider has just told this application who the
      // visitor is. Whatever the tab was holding - the AdminCP's privileged
      // entries, and the previous visitor's own files and devices - belonged to
      // whoever was here before them.
      removeAdminIdentityQueries(queryClient);
      removeUserIdentityQueries(queryClient);
      await invalidateSession(queryClient);
    }

    return ssoCallbackResult(result);
  };
};

export const useLinkSsoAction = ({
  onSignedIn,
  providerId,
}: {
  onSignedIn: () => void;
  providerId: string;
}): SSOLinkSubmit => {
  const queryClient = useQueryClient();

  return async ({ password, token }) => {
    const result = await authTransport().linkSso({
      password,
      providerId,
      token,
    });

    if (!result.ok) return ssoLinkFormResult(result);

    removeAdminIdentityQueries(queryClient);
    removeUserIdentityQueries(queryClient);
    await invalidateSession(queryClient);
    onSignedIn();

    return undefined;
  };
};

export const useSignOutAction = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async ({ isAdmin = false }: { isAdmin?: boolean } = {}) => {
    const result = await authTransport().signOut({ isAdmin });

    if (!result.ok) return result;

    const current = queryClient.getQueryData(sessionQueryOptions().queryKey);
    if (current) setSessionData(queryClient, anonymousSession(current));

    removeAdminIdentityQueries(queryClient);
    removeUserIdentityQueries(queryClient);

    await invalidateSession(queryClient);
    await router.invalidate();

    return result;
  };
};

export const useSignUpAction = ({
  destination,
}: {
  destination: () => string;
}): SignUpSubmit => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async values => {
    const result = await authTransport().signUp(values);

    if (shouldRefreshSessionAfterSignUp(result)) {
      // A verified sign-up mints a session, so somebody new is now the visitor
      // this tab belongs to - the same identity boundary the login form crosses,
      // and the same response, in both halves. The unverified path deliberately
      // does not reach here: no session was minted, so nothing about who this
      // browser holds data for has changed.
      removeAdminIdentityQueries(queryClient);
      removeUserIdentityQueries(queryClient);
      await invalidateSession(queryClient);
      await router.navigate(internalDestination(destination()));
    }

    return signUpFormResult(result);
  };
};

export const requestPasswordResetAction: PasswordResetSubmit = async values =>
  passwordResetFormResult(await authTransport().requestPasswordReset(values));

export const changePasswordFromResetAction: ChangePasswordSubmit =
  async values =>
    changePasswordFormResult(
      await authTransport().changePasswordFromReset(values),
    );

/**
 * Spends the confirmation link a sign-up emailed. No session comes back - the
 * member signs in with their own password afterwards - so there is no identity
 * boundary to cross and nothing cached to drop.
 */
export const confirmEmailAction =
  (token: string): ConfirmEmailSubmit =>
  async () =>
    confirmEmailResult(await authTransport().verifyEmail({ token }));

export const resendEmailVerificationAction: ResendVerificationSubmit =
  async values =>
    resendVerificationFormResult(
      await authTransport().resendEmailVerification(values),
    );
