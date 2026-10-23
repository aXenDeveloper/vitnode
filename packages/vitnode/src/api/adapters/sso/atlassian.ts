import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import {
  bearerAuth,
  claimString,
  formPost,
  requestSsoProviderJson,
  requireSsoOption,
} from "@/api/lib/sso-protocol";
import { getRedirectUri } from "@/api/models/sso";

import { ATLASSIAN_ICON } from "./icons";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1).default("Bearer"),
});

const meSchema = z.object({
  account_id: z.string().min(1),
  email: z.string().nullable().optional(),
  email_verified: z.boolean().nullable().optional(),
  name: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
  picture: z.string().nullable().optional(),
});

/**
 * Sign in with Atlassian: an SSO adapter for the API config's
 * `authorization.ssoAdapters`, using Atlassian's OAuth 2.0 (3LO). Requests
 * only `read:me` - the signed-in person's account, nothing from Jira,
 * Confluence or any other product - and redirects back to
 * `login/sso/atlassian` under `VITNODE_WEB_URL`.
 *
 * The email is trusted only with `email_verified: true`; Atlassian may also
 * hide it under the person's privacy settings, and a new member then confirms
 * an address in VitNode with a code. Supplies the avatar for profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { AtlassianSSOApiPlugin } from "@vitnode/core/api/adapters/sso/atlassian";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       AtlassianSSOApiPlugin({
 *         clientId: process.env.ATLASSIAN_CLIENT_ID,
 *         clientSecret: process.env.ATLASSIAN_CLIENT_SECRET,
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const AtlassianSSOApiPlugin = ({
  clientId,
  clientSecret,
}: {
  /** The OAuth 2.0 integration's Client ID (Settings). `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The integration's Secret. Needed to exchange the code. */
  clientSecret: string | undefined;
}): SSOApiPlugin => {
  const id = "atlassian";
  const redirectUri = getRedirectUri(id);

  return {
    brandColor: "#0052CC",
    icon: ATLASSIAN_ICON,
    id,
    name: "Atlassian",
    profileFields: ["avatar"],
    getUrl: ({ state }) => {
      const url = new URL("https://auth.atlassian.com/authorize");
      url.searchParams.set("audience", "api.atlassian.com");
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "Atlassian", "client ID"),
      );
      url.searchParams.set("scope", "read:me");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("prompt", "consent");

      return url.toString();
    },
    fetchToken: async code =>
      await requestSsoProviderJson({
        init: formPost({
          client_id: requireSsoOption(clientId, "Atlassian", "client ID"),
          client_secret: requireSsoOption(
            clientSecret,
            "Atlassian",
            "client secret",
          ),
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        schema: tokenSchema,
        step: "token",
        url: "https://auth.atlassian.com/oauth/token",
      }),
    fetchUser: async ({ access_token }) => {
      const me = await requestSsoProviderJson({
        init: { headers: bearerAuth(access_token) },
        schema: meSchema,
        step: "profile",
        url: "https://api.atlassian.com/me",
      });
      const email = claimString(me.email);

      return {
        avatarUrl: me.picture ?? null,
        email,
        emailVerified: email !== null && me.email_verified === true,
        id: me.account_id,
        username: me.nickname ?? me.name ?? null,
      };
    },
  };
};
