import "@tanstack/react-start/server-only";

import { CONFIG_PLUGIN } from "@/config";
import { fetcher } from "@/tanstack/fetcher/server";

import { createAuthOperations } from "./transport-operations";

/**
 * The server's own transport: the server fetcher, and the cookie relay.
 *
 * `allowSaveCookies: true` on exactly the flows whose answer carries the
 * session cookie - sign-in, sign-out, the three SSO steps and sign-up. A
 * password reset request and a token-based password change never mint a
 * session, so neither has ever relayed a cookie and neither does here.
 */
const operations = createAuthOperations({
  changePasswordFromReset: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: data },
      method: "post",
      module: "users",
      path: "/change-password",
    }),

  completeSso: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      allowSaveCookies: true,
      args: {
        params: { providerId: data.providerId },
        query: { code: data.code, state: data.state },
      },
      method: "get",
      module: "users/sso",
      path: "/{providerId}/callback",
    }),

  linkSso: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      allowSaveCookies: true,
      args: {
        body: { password: data.password, token: data.token },
        params: { providerId: data.providerId },
      },
      method: "post",
      module: "users/sso",
      path: "/{providerId}/link",
    }),

  readSession: async () =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "users",
      path: "/session",
    }),

  requestPasswordReset: async ({ captchaToken, email }) =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      captchaToken,
      args: { body: { email } },
      method: "post",
      module: "users",
      path: "/reset-password",
    }),

  signIn: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      allowSaveCookies: true,
      args: { body: data },
      method: "post",
      module: "users",
      path: "/sign_in",
    }),

  signOut: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      allowSaveCookies: true,
      args: { body: { isAdmin: data.isAdmin ?? false } },
      method: "delete",
      module: "users",
      path: "/sign_out",
    }),

  signUp: async ({ captchaToken, ...body }) =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      allowSaveCookies: true,
      captchaToken,
      args: { body },
      method: "post",
      module: "users",
      path: "/sign_up",
    }),

  startSso: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      allowSaveCookies: true,
      args: { params: { providerId: data.providerId } },
      method: "post",
      module: "users/sso",
      path: "/{providerId}",
    }),
});

export const changePasswordFromResetOnApi = operations.changePasswordFromReset;
export const completeSsoOnApi = operations.completeSso;
export const linkSsoOnApi = operations.linkSso;
export const readSessionOnApi = operations.readSession;
export const requestPasswordResetOnApi = operations.requestPasswordReset;
export const signInOnApi = operations.signIn;
export const signOutOnApi = operations.signOut;
export const signUpOnApi = operations.signUp;
export const startSsoOnApi = operations.startSso;
