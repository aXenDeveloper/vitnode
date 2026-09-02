import "@tanstack/react-start/server-only";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/tanstack/fetcher/server";

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

import {
  changePasswordResultFromStatus,
  completeSsoResultFromStatus,
  isUsableSessionStatus,
  passwordResetRequestResultFromStatus,
  SESSION_UNAVAILABLE,
  signInResultFromStatus,
  signOutResultFromStatus,
  signUpResultFromStatus,
  ssoStartResultFromStatus,
} from "./contract";

export const readSessionOnApi = async () => {
  try {
    const response = await fetcher(usersModule, {
      method: "get",
      module: "users",
      path: "/session",
    });

    if (isUsableSessionStatus(response.status)) return await response.json();

    throw new Error(`the session route answered ${response.status}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[auth] ${SESSION_UNAVAILABLE}`, error);

    // eslint-disable-next-line preserve-caught-error
    throw new Error(SESSION_UNAVAILABLE);
  }
};

const callUsersApi = async (
  call: () => Promise<Response>,
): Promise<null | Response> => {
  try {
    return await call();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[auth] users API call failed", error);

    return null;
  }
};

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const readText = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

export const signInOnApi = async (data: SignInInput): Promise<SignInResult> => {
  const response = await callUsersApi(async () =>
    fetcher(usersModule, {
      allowSaveCookies: true,
      args: { body: data },
      method: "post",
      module: "users",
      path: "/sign_in",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  return signInResultFromStatus(response.status);
};

export const signOutOnApi = async (
  data: SignOutInput,
): Promise<SignOutResult> => {
  const response = await callUsersApi(async () =>
    fetcher(usersModule, {
      allowSaveCookies: true,
      args: { body: { isAdmin: data.isAdmin ?? false } },
      method: "delete",
      module: "users",
      path: "/sign_out",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  return signOutResultFromStatus(response.status);
};

export const startSsoOnApi = async (
  data: SsoStartInput,
): Promise<SsoStartResult> => {
  const response = await callUsersApi(async () =>
    fetcher(usersModule, {
      allowSaveCookies: true,
      args: { params: { providerId: data.providerId } },
      method: "post",
      module: "users/sso",
      path: "/{providerId}",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  if (response.status !== 200) {
    return ssoStartResultFromStatus(response.status, undefined);
  }

  const { url } = await response.json();

  return ssoStartResultFromStatus(response.status, url);
};

export const completeSsoOnApi = async (
  data: SsoCallbackInput,
): Promise<CompleteSsoResult> => {
  const response = await callUsersApi(async () =>
    fetcher(usersModule, {
      allowSaveCookies: true,
      args: {
        params: { providerId: data.providerId },
        query: { code: data.code, state: data.state },
      },
      method: "get",
      module: "users/sso",
      path: "/{providerId}/callback",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  return completeSsoResultFromStatus(response.status);
};

export const signUpOnApi = async ({
  captchaToken,
  ...body
}: SignUpInput): Promise<SignUpResult> => {
  const response = await callUsersApi(async () =>
    fetcher(usersModule, {
      allowSaveCookies: true,
      captchaToken,
      args: { body },
      method: "post",
      module: "users",
      path: "/sign_up",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  if (response.status === 201) {
    return signUpResultFromStatus(201, { body: await readJson(response) });
  }

  if (response.status === 409) {
    return signUpResultFromStatus(409, { conflict: await readText(response) });
  }

  return signUpResultFromStatus(response.status);
};

export const requestPasswordResetOnApi = async ({
  captchaToken,
  email,
}: PasswordResetRequestInput): Promise<PasswordResetRequestResult> => {
  const response = await callUsersApi(async () =>
    fetcher(usersModule, {
      captchaToken,
      args: { body: { email } },
      method: "post",
      module: "users",
      path: "/reset-password",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  return passwordResetRequestResultFromStatus(response.status);
};

export const changePasswordFromResetOnApi = async (
  data: ChangePasswordInput,
): Promise<ChangePasswordResult> => {
  const response = await callUsersApi(async () =>
    fetcher(usersModule, {
      args: { body: data },
      method: "post",
      module: "users",
      path: "/change-password",
    }),
  );

  if (!response) return { ok: false, reason: "server_error" };

  return changePasswordResultFromStatus(response.status);
};
