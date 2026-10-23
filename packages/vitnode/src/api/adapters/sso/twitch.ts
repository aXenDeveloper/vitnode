import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import {
  bearerAuth,
  claimString,
  formPost,
  remoteJwks,
  requestSsoProviderJson,
  requireSsoOption,
  ssoProviderFailure,
  verifySsoIdToken,
} from "@/api/lib/sso-protocol";
import { getRedirectUri } from "@/api/models/sso";

import { TWITCH_ICON } from "./icons";

const ISSUER = "https://id.twitch.tv/oauth2";

const CLAIMS = JSON.stringify({
  id_token: { email: null, email_verified: null },
  userinfo: {
    email: null,
    email_verified: null,
    picture: null,
    preferred_username: null,
  },
});

const tokenSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1),
  token_type: z.string().min(1),
});

const userInfoSchema = z.object({
  email: z.string().nullable().optional(),
  email_verified: z.boolean().nullable().optional(),
  picture: z.string().nullable().optional(),
  preferred_username: z.string().nullable().optional(),
  sub: z.string().min(1),
});

/**
 * Sign in with Twitch: an SSO adapter for the API config's
 * `authorization.ssoAdapters`, using OpenID Connect. Requests
 * `openid user:read:email`, validates the ID token (signature, issuer,
 * audience, expiry, nonce) and reads the email and avatar from Twitch's
 * UserInfo endpoint. Redirects back to `login/sso/twitch` under
 * `VITNODE_WEB_URL`.
 *
 * Twitch shares the email only once the account has verified it; without one
 * a new member confirms an address in VitNode with a code. Supplies the avatar
 * for profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { TwitchSSOApiPlugin } from "@vitnode/core/api/adapters/sso/twitch";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       TwitchSSOApiPlugin({
 *         clientId: process.env.TWITCH_CLIENT_ID,
 *         clientSecret: process.env.TWITCH_CLIENT_SECRET,
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const TwitchSSOApiPlugin = ({
  clientId,
  clientSecret,
}: {
  /** The Client ID from the Twitch Developer Console. `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The Client Secret. Needed to exchange the code. */
  clientSecret: string | undefined;
}): SSOApiPlugin => {
  const id = "twitch";
  const redirectUri = getRedirectUri(id);

  return {
    icon: TWITCH_ICON,
    id,
    name: "Twitch",
    profileFields: ["avatar"],
    getUrl: ({ nonce, state }) => {
      const url = new URL(`${ISSUER}/authorize`);
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "Twitch", "client ID"),
      );
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid user:read:email");
      url.searchParams.set("claims", CLAIMS);
      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);

      return url.toString();
    },
    fetchToken: async code =>
      await requestSsoProviderJson({
        init: formPost({
          client_id: requireSsoOption(clientId, "Twitch", "client ID"),
          client_secret: requireSsoOption(
            clientSecret,
            "Twitch",
            "client secret",
          ),
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        schema: tokenSchema,
        step: "token",
        url: `${ISSUER}/token`,
      }),
    fetchUser: async ({ access_token, id_token }, { nonce }) => {
      const claims = await verifySsoIdToken({
        audience: requireSsoOption(clientId, "Twitch", "client ID"),
        idToken: id_token,
        issuer: ISSUER,
        keys: remoteJwks(`${ISSUER}/keys`),
        nonce,
      });
      const info = await requestSsoProviderJson({
        init: { headers: bearerAuth(access_token) },
        schema: userInfoSchema,
        step: "profile",
        url: `${ISSUER}/userinfo`,
      });
      if (info.sub !== claims.sub) {
        throw ssoProviderFailure(
          "Twitch UserInfo answered for another account",
        );
      }

      const email = claimString(info.email);

      return {
        avatarUrl: info.picture ?? null,
        email,
        emailVerified: email !== null && info.email_verified === true,
        id: info.sub,
        username: info.preferred_username ?? null,
      };
    },
  };
};
