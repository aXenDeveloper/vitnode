import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import {
  basicClientAuth,
  bearerAuth,
  claimString,
  formPost,
  requestSsoProviderJson,
  requireSsoOption,
} from "@/api/lib/sso-protocol";
import { getRedirectUri } from "@/api/models/sso";

import { X_ICON } from "./icons";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
});

const userSchema = z.object({
  data: z.object({
    confirmed_email: z.string().optional(),
    id: z.string().regex(/^\d{1,32}$/),
    name: z.string().optional(),
    profile_image_url: z.string().optional(),
    username: z.string(),
  }),
});

const thumbnailToFullSize = (url: string | undefined): null | string =>
  url?.replace(/_normal(\.\w+)$/, "_400x400$1") ?? null;

/**
 * Sign in with X (formerly Twitter): an SSO adapter for the API config's
 * `authorization.ssoAdapters`, using OAuth 2.0 with PKCE. Requests
 * `tweet.read users.read` (both needed to read the signed-in account) plus
 * `users.email`, and redirects back to `login/sso/twitter` under
 * `VITNODE_WEB_URL`.
 *
 * The email arrives only when the X app has "Request email from users"
 * switched on and the account has a confirmed address; without one a new
 * member confirms an email in VitNode by email link. Supplies the avatar for
 * profile sync. The provider id stays `twitter`.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { TwitterSSOApiPlugin } from "@vitnode/core/api/adapters/sso/twitter";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       TwitterSSOApiPlugin({
 *         clientId: process.env.TWITTER_CLIENT_ID,
 *         clientSecret: process.env.TWITTER_CLIENT_SECRET,
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const TwitterSSOApiPlugin = ({
  clientId,
  clientSecret,
  requestEmail = true,
}: {
  /** The OAuth 2.0 Client ID of a confidential ("Web App") X app. `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The OAuth 2.0 Client Secret. Needed to exchange the code. */
  clientSecret: string | undefined;
  /**
   * Ask for the `users.email` scope and the account's `confirmed_email`.
   * Turn it off when the X app is not allowed to request email - X rejects the
   * scope otherwise. Defaults to `true`.
   */
  requestEmail?: boolean;
}): SSOApiPlugin => {
  const id = "twitter";
  const redirectUri = getRedirectUri(id);
  const scopes = [
    "tweet.read",
    "users.read",
    ...(requestEmail ? ["users.email"] : []),
  ];
  const userFields = [
    "profile_image_url",
    ...(requestEmail ? ["confirmed_email"] : []),
  ];

  return {
    brandColor: "#000000",
    icon: X_ICON,
    id,
    name: "X",
    profileFields: ["avatar"],
    getUrl: ({ codeChallenge, codeChallengeMethod, state }) => {
      const url = new URL("https://x.com/i/oauth2/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "X", "client ID"),
      );
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", scopes.join(" "));
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", codeChallengeMethod);

      return url.toString();
    },
    fetchToken: async (code, { codeVerifier }) =>
      await requestSsoProviderJson({
        init: formPost(
          {
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          },
          basicClientAuth(
            requireSsoOption(clientId, "X", "client ID"),
            requireSsoOption(clientSecret, "X", "client secret"),
          ),
        ),
        schema: tokenSchema,
        step: "token",
        url: "https://api.x.com/2/oauth2/token",
      }),
    fetchUser: async ({ access_token }) => {
      const url = new URL("https://api.x.com/2/users/me");
      url.searchParams.set("user.fields", userFields.join(","));
      const { data } = await requestSsoProviderJson({
        init: { headers: bearerAuth(access_token) },
        schema: userSchema,
        step: "profile",
        url,
      });
      const email = claimString(data.confirmed_email);

      return {
        avatarUrl: thumbnailToFullSize(data.profile_image_url),
        email,
        emailVerified: email !== null,
        id: data.id,
        username: claimString(data.name) ?? data.username,
      };
    },
  };
};
