import type {
  AdminPasskeySignInResult,
  ChangePasswordInput,
  ChangePasswordResult,
  CompleteSsoResult,
  PasskeySignInInput,
  PasskeySignInResult,
  PasskeySignInStartResult,
  PasswordResetRequestInput,
  PasswordResetRequestResult,
  ResendEmailVerificationInput,
  ResendEmailVerificationResult,
  SignInInput,
  SignInResult,
  SignOutInput,
  SignOutResult,
  SignUpInput,
  SignUpResult,
  SsoCallbackInput,
  SsoLinkInput,
  SsoLinkResult,
  SsoStartInput,
  SsoStartResult,
  VerifyEmailInput,
  VerifyEmailResult,
} from "./contract";
import type { SessionApi } from "./session-api";

import { defaultAuthTransport } from "./default-transport";

export interface AuthTransport {
  changePasswordFromReset: (
    input: ChangePasswordInput,
  ) => Promise<ChangePasswordResult>;
  completeSso: (input: SsoCallbackInput) => Promise<CompleteSsoResult>;
  finishAdminPasskeySignIn: (
    input: PasskeySignInInput,
  ) => Promise<AdminPasskeySignInResult>;
  finishPasskeySignIn: (
    input: PasskeySignInInput,
  ) => Promise<PasskeySignInResult>;
  linkSso: (input: SsoLinkInput) => Promise<SsoLinkResult>;

  readSession: () => Promise<SessionApi>;
  requestPasswordReset: (
    input: PasswordResetRequestInput,
  ) => Promise<PasswordResetRequestResult>;
  resendEmailVerification: (
    input: ResendEmailVerificationInput,
  ) => Promise<ResendEmailVerificationResult>;
  signIn: (input: SignInInput) => Promise<SignInResult>;
  signOut: (input: SignOutInput) => Promise<SignOutResult>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  startAdminPasskeySignIn: () => Promise<PasskeySignInStartResult>;
  startPasskeySignIn: () => Promise<PasskeySignInStartResult>;
  startSso: (input: SsoStartInput) => Promise<SsoStartResult>;
  verifyEmail: (input: VerifyEmailInput) => Promise<VerifyEmailResult>;
}

let registered: AuthTransport | undefined;

export const setAuthTransport = (transport: AuthTransport): void => {
  registered = transport;
};

/** Drops a registered override, so the built-in default answers again. */
export const resetAuthTransport = (): void => {
  registered = undefined;
};

export const authTransport = (): AuthTransport =>
  registered ?? defaultAuthTransport;

/** Whether an application registered a transport of its own. */
export const hasAuthTransport = (): boolean => registered !== undefined;
