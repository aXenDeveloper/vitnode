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

import { LINKEDIN_ICON } from "./icons";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1).default("Bearer"),
});

const userInfoSchema = z.object({
  email: z.string().nullable().optional(),
  email_verified: z.boolean().nullable().optional(),
  family_name: z.string().nullable().optional(),
  given_name: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  picture: z.string().nullable().optional(),
  sub: z.string().min(1),
});

/**
 * Sign In with LinkedIn using OpenID Connect: an SSO adapter for the API
 * config's `authorization.ssoAdapters`. Requests `openid profile email` and
 * reads the member from LinkedIn's UserInfo endpoint with the access token it
 * just received from LinkedIn's token endpoint over TLS (OIDC Core §5.3), so
 * no ID token needs to be decoded. Redirects back to `login/sso/linkedin`
 * under `VITNODE_WEB_URL`.
 *
 * The email is trusted only with `email_verified: true`; without one a new
 * member confirms an address in VitNode with a code. Supplies the avatar,
 * first and last name for profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { LinkedInSSOApiPlugin } from "@vitnode/core/api/adapters/sso/linkedin";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       LinkedInSSOApiPlugin({
 *         clientId: process.env.LINKEDIN_CLIENT_ID,
 *         clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const LinkedInSSOApiPlugin = ({
  clientId,
  clientSecret,
}: {
  /** The app's Client ID (Auth tab). `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The app's Primary Client Secret. Needed to exchange the code. */
  clientSecret: string | undefined;
}): SSOApiPlugin => {
  const id = "linkedin";
  const redirectUri = getRedirectUri(id);

  return {
    brandColor: "#0A66C2",
    icon: LINKEDIN_ICON,
    id,
    name: "LinkedIn",
    profileFields: ["avatar", "firstName", "lastName"],
    getUrl: ({ state }) => {
      const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
      url.searchParams.set("response_type", "code");
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "LinkedIn", "client ID"),
      );
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "openid profile email");
      url.searchParams.set("state", state);

      return url.toString();
    },
    fetchToken: async code =>
      await requestSsoProviderJson({
        init: formPost({
          client_id: requireSsoOption(clientId, "LinkedIn", "client ID"),
          client_secret: requireSsoOption(
            clientSecret,
            "LinkedIn",
            "client secret",
          ),
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        schema: tokenSchema,
        step: "token",
        url: "https://www.linkedin.com/oauth/v2/accessToken",
      }),
    fetchUser: async ({ access_token }) => {
      const info = await requestSsoProviderJson({
        init: { headers: bearerAuth(access_token) },
        schema: userInfoSchema,
        step: "profile",
        url: "https://api.linkedin.com/v2/userinfo",
      });
      const email = claimString(info.email);

      return {
        avatarUrl: info.picture ?? null,
        email,
        emailVerified: email !== null && info.email_verified === true,
        firstName: info.given_name ?? null,
        id: info.sub,
        lastName: info.family_name ?? null,
        username: info.name ?? null,
      };
    },
  };
};
