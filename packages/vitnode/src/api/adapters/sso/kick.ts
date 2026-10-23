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

import { KICK_ICON } from "./icons";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1).default("Bearer"),
});

const usersSchema = z.object({
  data: z
    .array(
      z.object({
        email: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        profile_picture: z.string().nullable().optional(),
        user_id: z.union([
          z.number().int().nonnegative(),
          z.string().regex(/^\d+$/),
        ]),
      }),
    )
    .min(1),
});

/**
 * Sign in with Kick: an SSO adapter for the API config's
 * `authorization.ssoAdapters`, using OAuth 2.1 with PKCE (which Kick
 * requires). Requests only `user:read` and redirects back to `login/sso/kick`
 * under `VITNODE_WEB_URL`.
 *
 * Kick does not say whether an account's email is verified, so VitNode never
 * trusts it: a new member confirms an address with a code first, and a
 * returning member signs in by their Kick user ID. Supplies the avatar for
 * profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { KickSSOApiPlugin } from "@vitnode/core/api/adapters/sso/kick";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       KickSSOApiPlugin({
 *         clientId: process.env.KICK_CLIENT_ID,
 *         clientSecret: process.env.KICK_CLIENT_SECRET,
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const KickSSOApiPlugin = ({
  clientId,
  clientSecret,
}: {
  /** The app's Client ID. `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The app's Client Secret. Needed to exchange the code. */
  clientSecret: string | undefined;
}): SSOApiPlugin => {
  const id = "kick";
  const redirectUri = getRedirectUri(id);

  return {
    brandColor: "#53FC19",
    icon: KICK_ICON,
    id,
    name: "Kick",
    profileFields: ["avatar"],
    getUrl: ({ codeChallenge, codeChallengeMethod, state }) => {
      const url = new URL("https://id.kick.com/oauth/authorize");
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "Kick", "client ID"),
      );
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "user:read");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", codeChallengeMethod);

      return url.toString();
    },
    fetchToken: async (code, { codeVerifier }) =>
      await requestSsoProviderJson({
        init: formPost({
          client_id: requireSsoOption(clientId, "Kick", "client ID"),
          client_secret: requireSsoOption(
            clientSecret,
            "Kick",
            "client secret",
          ),
          code,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        schema: tokenSchema,
        step: "token",
        url: "https://id.kick.com/oauth/token",
      }),
    fetchUser: async ({ access_token }) => {
      const {
        data: [user],
      } = await requestSsoProviderJson({
        init: { headers: bearerAuth(access_token) },
        schema: usersSchema,
        step: "profile",
        url: "https://api.kick.com/public/v1/users",
      });

      return {
        avatarUrl: user.profile_picture ?? null,
        email: claimString(user.email),
        emailVerified: false,
        id: String(user.user_id),
        username: user.name ?? null,
      };
    },
  };
};
