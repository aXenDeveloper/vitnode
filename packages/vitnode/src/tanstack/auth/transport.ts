import type {
  ChangePasswordInput,
  ChangePasswordResult,
  CompleteSsoResult,
  PasswordResetRequestInput,
  PasswordResetRequestResult,
  SignInInput,
  SignInResult,
  SignOutInput,
  SignOutResult,
  SignUpInput,
  SignUpResult,
  SsoCallbackInput,
  SsoStartInput,
  SsoStartResult,
} from "./contract";
import type { SessionApi } from "./session-api";

export interface AuthTransport {
  changePasswordFromReset: (
    input: ChangePasswordInput,
  ) => Promise<ChangePasswordResult>;
  completeSso: (input: SsoCallbackInput) => Promise<CompleteSsoResult>;

  readSession: () => Promise<SessionApi>;
  requestPasswordReset: (
    input: PasswordResetRequestInput,
  ) => Promise<PasswordResetRequestResult>;
  signIn: (input: SignInInput) => Promise<SignInResult>;
  signOut: (input: SignOutInput) => Promise<SignOutResult>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  startSso: (input: SsoStartInput) => Promise<SsoStartResult>;
}

let registered: AuthTransport | undefined;

export const AUTH_TRANSPORT_MISSING =
  "No auth transport is registered. Call setAuthTransport() from a module the application always loads - the router entry - before any auth route runs.";

export const setAuthTransport = (transport: AuthTransport): void => {
  registered = transport;
};

export const authTransport = (): AuthTransport => {
  if (!registered) throw new Error(AUTH_TRANSPORT_MISSING);

  return registered;
};

/** Whether an application has registered a transport yet. For tests. */
export const hasAuthTransport = (): boolean => registered !== undefined;
