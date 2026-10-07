import { CONFIG_PLUGIN } from "@/config";
import { fetcher } from "@/tanstack/fetcher";

import { createAuthOperations } from "./transport-operations";

/**
 * The browser's own transport: the universal fetcher, and no cookie relay.
 *
 * A browser never relays `Set-Cookie` by hand - the fetch it makes is the one
 * the cookie is set on. `allowSaveCookies` is the server adapter's concern, and
 * it is the only difference between the two.
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
      args: {
        params: { providerId: data.providerId },
        query: { code: data.code, state: data.state },
      },
      method: "get",
      module: "users/sso",
      path: "/{providerId}/callback",
    }),

  finishAdminPasskeySignIn: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: data },
      method: "post",
      module: "users/passkeys",
      path: "/admin-sign-in",
    }),

  finishPasskeySignIn: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: data },
      method: "post",
      module: "users/passkeys",
      path: "/sign-in",
    }),

  linkSso: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
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

  resendEmailVerification: async ({ captchaToken, email }) =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      captchaToken,
      args: { body: { email } },
      method: "post",
      module: "users",
      path: "/verify-email/resend",
    }),

  signIn: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: data },
      method: "post",
      module: "users",
      path: "/sign_in",
    }),

  signOut: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: { isAdmin: data.isAdmin ?? false } },
      method: "delete",
      module: "users",
      path: "/sign_out",
    }),

  signUp: async ({ captchaToken, ...body }) =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      captchaToken,
      args: { body },
      method: "post",
      module: "users",
      path: "/sign_up",
    }),

  startAdminPasskeySignIn: async () =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "post",
      module: "users/passkeys",
      path: "/admin-sign-in/options",
    }),

  startPasskeySignIn: async () =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "post",
      module: "users/passkeys",
      path: "/sign-in/options",
    }),

  startSso: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { params: { providerId: data.providerId } },
      method: "post",
      module: "users/sso",
      path: "/{providerId}",
    }),

  verifyEmail: async data =>
    await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: data },
      method: "post",
      module: "users",
      path: "/verify-email",
    }),
});

export const readSessionFromApi = operations.readSession;

export const defaultAuthTransport = {
  changePasswordFromReset: operations.changePasswordFromReset,
  completeSso: operations.completeSso,
  finishAdminPasskeySignIn: operations.finishAdminPasskeySignIn,
  finishPasskeySignIn: operations.finishPasskeySignIn,
  linkSso: operations.linkSso,
  readSession: operations.readSession,
  requestPasswordReset: operations.requestPasswordReset,
  resendEmailVerification: operations.resendEmailVerification,
  signIn: operations.signIn,
  signOut: operations.signOut,
  signUp: operations.signUp,
  startAdminPasskeySignIn: operations.startAdminPasskeySignIn,
  startPasskeySignIn: operations.startPasskeySignIn,
  startSso: operations.startSso,
  verifyEmail: operations.verifyEmail,
};
