import type {
  AdminPasskeySignInResult,
  ChangePasswordInput,
  ChangePasswordResult,
  CompleteSsoResult,
  PasskeySignInInput,
  PasskeySignInOptionsBody,
  PasskeySignInResult,
  PasskeySignInStartResult,
  PasswordResetRequestInput,
  PasswordResetRequestResult,
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
} from "./contract";

import { callUsersApi, readJson, readText } from "./api-helpers";
import {
  adminPasskeySignInResultFromStatus,
  changePasswordResultFromStatus,
  completeSsoResultFromStatus,
  isUsableSessionStatus,
  passkeySignInResultFromStatus,
  passkeySignInStartResultFromStatus,
  passwordResetRequestResultFromStatus,
  SESSION_UNAVAILABLE,
  signInResultFromStatus,
  signOutResultFromStatus,
  signUpResultFromStatus,
  ssoLinkResultFromStatus,
  ssoStartResultFromStatus,
} from "./contract";

/** The only thing a status-mapped operation reads off its answer. */
export interface AuthApiStatus {
  status: number;
}

export interface AuthApiJson<TBody> extends AuthApiStatus {
  json: () => Promise<TBody>;
}

export interface AuthApiJsonOrText<TBody> extends AuthApiJson<TBody> {
  text: () => Promise<string>;
}

/**
 * The thirteen calls an auth transport makes, as requests rather than as results.
 *
 * A requester says *where* a call goes and *how* it travels - which fetcher,
 * and whether the answer's cookies may be relayed. Everything after the answer
 * arrives - the status mapping, the bodies read off the finite cases, the
 * failures that must not throw - is this module's, so the browser adapter and
 * the server one cannot drift apart.
 *
 * Generic in the session payload alone: `SessionApi` is inferred from the route
 * the adapter actually calls, and a requester that erased it would erase that
 * type for every consumer of `readSession`.
 */
export interface AuthApiRequester<TSession> {
  changePasswordFromReset: (
    input: ChangePasswordInput,
  ) => Promise<AuthApiStatus>;
  completeSso: (input: SsoCallbackInput) => Promise<AuthApiJson<unknown>>;
  finishAdminPasskeySignIn: (
    input: PasskeySignInInput,
  ) => Promise<AuthApiJson<unknown>>;
  finishPasskeySignIn: (input: PasskeySignInInput) => Promise<AuthApiStatus>;
  linkSso: (input: SsoLinkInput) => Promise<AuthApiStatus>;
  readSession: () => Promise<AuthApiJson<TSession>>;
  requestPasswordReset: (
    input: PasswordResetRequestInput,
  ) => Promise<AuthApiStatus>;
  signIn: (input: SignInInput) => Promise<AuthApiStatus>;
  signOut: (input: SignOutInput) => Promise<AuthApiStatus>;
  signUp: (input: SignUpInput) => Promise<AuthApiJsonOrText<unknown>>;
  startAdminPasskeySignIn: () => Promise<AuthApiJson<PasskeySignInOptionsBody>>;
  startPasskeySignIn: () => Promise<AuthApiJson<PasskeySignInOptionsBody>>;
  startSso: (input: SsoStartInput) => Promise<AuthApiJson<{ url?: unknown }>>;
}

export interface AuthOperations<TSession> {
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
  readSession: () => Promise<TSession>;
  requestPasswordReset: (
    input: PasswordResetRequestInput,
  ) => Promise<PasswordResetRequestResult>;
  signIn: (input: SignInInput) => Promise<SignInResult>;
  signOut: (input: SignOutInput) => Promise<SignOutResult>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  startAdminPasskeySignIn: () => Promise<PasskeySignInStartResult>;
  startPasskeySignIn: () => Promise<PasskeySignInStartResult>;
  startSso: (input: SsoStartInput) => Promise<SsoStartResult>;
}

/** The `url` a start answer carries, with no assumption that it carries one. */
const startUrlOf = (body: { url?: unknown }): unknown => body.url;

const startPasskeyCeremony = async (
  call: () => Promise<AuthApiJson<PasskeySignInOptionsBody>>,
): Promise<PasskeySignInStartResult> => {
  const response = await callUsersApi(call);

  if (!response) return { ok: false, reason: "server_error" };
  if (response.status !== 200) {
    return passkeySignInStartResultFromStatus(response.status);
  }

  const body = await callUsersApi(async () => response.json());

  return passkeySignInStartResultFromStatus(response.status, body ?? undefined);
};

export const createAuthOperations = <TSession>(
  request: AuthApiRequester<TSession>,
): AuthOperations<TSession> => ({
  changePasswordFromReset: async data => {
    const response = await callUsersApi(async () =>
      request.changePasswordFromReset(data),
    );

    if (!response) return { ok: false, reason: "server_error" };

    return changePasswordResultFromStatus(response.status);
  },

  completeSso: async data => {
    const response = await callUsersApi(async () => request.completeSso(data));

    if (!response) return { ok: false, reason: "server_error" };

    if (response.status === 409) {
      return completeSsoResultFromStatus(409, await readJson(response));
    }

    return completeSsoResultFromStatus(response.status);
  },

  finishAdminPasskeySignIn: async data => {
    const response = await callUsersApi(async () =>
      request.finishAdminPasskeySignIn(data),
    );

    if (!response) return { ok: false, reason: "server_error" };
    if (response.status === 403) {
      return adminPasskeySignInResultFromStatus(403, await readJson(response));
    }

    return adminPasskeySignInResultFromStatus(response.status);
  },

  finishPasskeySignIn: async data => {
    const response = await callUsersApi(async () =>
      request.finishPasskeySignIn(data),
    );

    if (!response) return { ok: false, reason: "server_error" };

    return passkeySignInResultFromStatus(response.status);
  },

  linkSso: async data => {
    const response = await callUsersApi(async () => request.linkSso(data));

    if (!response) return { ok: false, reason: "server_error" };

    return ssoLinkResultFromStatus(response.status);
  },

  readSession: async () => {
    try {
      const response = await request.readSession();

      if (isUsableSessionStatus(response.status)) return await response.json();

      throw new Error(`the session route answered ${response.status}`);
    } catch (error) {
      // oxlint-disable-next-line no-console
      console.error(`[auth] ${SESSION_UNAVAILABLE}`, error);

      // oxlint-disable-next-line preserve-caught-error
      throw new Error(SESSION_UNAVAILABLE);
    }
  },

  requestPasswordReset: async data => {
    const response = await callUsersApi(async () =>
      request.requestPasswordReset(data),
    );

    if (!response) return { ok: false, reason: "server_error" };

    return passwordResetRequestResultFromStatus(response.status);
  },

  signIn: async data => {
    const response = await callUsersApi(async () => request.signIn(data));

    if (!response) return { ok: false, reason: "server_error" };

    return signInResultFromStatus(response.status);
  },

  signOut: async data => {
    const response = await callUsersApi(async () => request.signOut(data));

    if (!response) return { ok: false, reason: "server_error" };

    return signOutResultFromStatus(response.status);
  },

  signUp: async data => {
    const response = await callUsersApi(async () => request.signUp(data));

    if (!response) return { ok: false, reason: "server_error" };

    if (response.status === 201) {
      return signUpResultFromStatus(201, { body: await readJson(response) });
    }

    if (response.status === 409) {
      return signUpResultFromStatus(409, {
        conflict: await readText(response),
      });
    }

    return signUpResultFromStatus(response.status);
  },

  startAdminPasskeySignIn: async () =>
    await startPasskeyCeremony(async () => request.startAdminPasskeySignIn()),

  startPasskeySignIn: async () =>
    await startPasskeyCeremony(async () => request.startPasskeySignIn()),

  startSso: async data => {
    const response = await callUsersApi(async () => request.startSso(data));

    if (!response) return { ok: false, reason: "server_error" };

    if (response.status !== 200) {
      return ssoStartResultFromStatus(response.status, undefined);
    }

    // `json()` rather than a swallowing read: a 200 whose body is not the
    // documented one is a broken API, not a missing provider, and the throw is
    // what the caller has always seen.
    return ssoStartResultFromStatus(
      response.status,
      startUrlOf(await response.json()),
    );
  },
});
