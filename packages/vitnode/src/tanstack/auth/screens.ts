import type { ChangePasswordMutationResult } from "@/views/auth/password-reset/change-password-form/schema";
import type { PasswordResetMutationResult } from "@/views/auth/password-reset/form/schema";
import type { SignInMutationResult } from "@/views/auth/sign-in/form/schema";
import type { SignUpMutationResult } from "@/views/auth/sign-up/form/schema";
import type { SSOStartResult as SsoButtonFeedback } from "@/views/auth/sso/buttons/sso-buttons-content";
import type { SSOCallbackResult } from "@/views/auth/sso/callback/sso-callback-result";
import type { SSOLinkMutationResult } from "@/views/auth/sso/link/schema";
import type {
  ConfirmEmailMutationResult,
  ResendVerificationMutationResult,
} from "@/views/auth/verify-email/schema";

import type {
  ChangePasswordResult,
  CompleteSsoResult,
  PasswordResetRequestResult,
  ResendEmailVerificationResult,
  SignInResult,
  SignUpResult,
  SsoLinkResult,
  SsoStartResult,
  VerifyEmailResult,
} from "./contract";
import type { SessionApi } from "./session-api";

export const signInFormResult = (
  result: SignInResult,
): SignInMutationResult => {
  if (result.ok) return undefined;

  return result.reason === "server_error"
    ? { message: "Internal Server Error" }
    : { message: result.reason };
};

export const ssoStartFeedback = (result: SsoStartResult): SsoButtonFeedback =>
  result.ok ? undefined : { message: result.reason };

export const ssoCallbackResult = (
  result: CompleteSsoResult,
): SSOCallbackResult => {
  if (result.ok) return {};

  if (result.reason !== "email_exists") return { failure: "unknown" };

  return result.offer
    ? { failure: "email_exists", offer: result.offer }
    : { failure: "email_exists" };
};

export const ssoLinkFormResult = (
  result: SsoLinkResult,
): SSOLinkMutationResult => {
  if (result.ok) return undefined;

  if (result.reason === "access_denied") return { message: "access_denied" };
  if (result.reason === "invalid_token" || result.reason === "already_linked") {
    return { message: "invalid_token" };
  }

  return { message: "Internal Server Error" };
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

export const confirmEmailResult = (
  result: VerifyEmailResult,
): ConfirmEmailMutationResult => {
  if (result.ok) return { email: result.email, kind: "confirmed" };

  return result.reason === "invalid_token"
    ? { kind: "invalid_token" }
    : { kind: "error" };
};

export const resendVerificationFormResult = (
  result: ResendEmailVerificationResult,
): ResendVerificationMutationResult =>
  result.ok ? undefined : { message: "Internal Server Error" };
