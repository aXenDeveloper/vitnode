import type { ChangePasswordMutationResult } from "@/views/auth/password-reset/change-password-form/schema";
import type { PasswordResetMutationResult } from "@/views/auth/password-reset/form/schema";
import type { SignInMutationResult } from "@/views/auth/sign-in/form/schema";
import type { SignUpMutationResult } from "@/views/auth/sign-up/form/schema";
import type { SSOStartResult as SsoButtonFeedback } from "@/views/auth/sso/buttons/sso-buttons-content";
import type { SSOCallbackResult } from "@/views/auth/sso/callback/sso-callback-result";

import type {
  ChangePasswordResult,
  CompleteSsoResult,
  PasswordResetRequestResult,
  SignInResult,
  SignUpResult,
  SsoStartResult,
} from "./contract";
import type { SessionApi } from "./session-api";

export const signInFormResult = (
  result: SignInResult,
): SignInMutationResult => {
  if (result.ok) return undefined;

  return result.reason === "access_denied"
    ? { message: "access_denied" }
    : { message: "Internal Server Error" };
};

export const ssoStartFeedback = (result: SsoStartResult): SsoButtonFeedback =>
  result.ok ? undefined : { message: result.reason };

export const ssoCallbackResult = (
  result: CompleteSsoResult,
): SSOCallbackResult => {
  if (result.ok) return {};

  return result.reason === "email_exists"
    ? { failure: "email_exists" }
    : { failure: "unknown" };
};

export const anonymousSession = (session: SessionApi): SessionApi => ({
  ...session,
  user: null,
});

export const signUpFormResult = (
  result: SignUpResult,
): SignUpMutationResult => {
  if (result.ok) {
    return result.emailVerified
      ? undefined
      : { emailConfirmation: result.email };
  }

  if (result.reason === "email_exists") return { message: "email_exists" };
  if (result.reason === "name_exists") return { message: "name_exists" };

  return { message: "Internal Server Error" };
};

export const passwordResetFormResult = (
  result: PasswordResetRequestResult,
): PasswordResetMutationResult =>
  result.ok ? undefined : { message: "Internal Server Error" };

export const changePasswordFormResult = (
  result: ChangePasswordResult,
): ChangePasswordMutationResult => {
  if (result.ok) return undefined;

  return {
    message:
      result.reason === "invalid_token"
        ? "invalid_token"
        : "internal_server_error",
  };
};
