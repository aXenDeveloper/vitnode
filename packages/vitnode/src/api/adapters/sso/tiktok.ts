import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import {
  bearerAuth,
  formPost,
  requestSsoProviderJson,
  requireSsoOption,
  ssoProviderFailure,
} from "@/api/lib/sso-protocol";
import { getRedirectUri } from "@/api/models/sso";

import { TIKTOK_ICON } from "./icons";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  open_id: z.string().min(1).optional(),
  token_type: z.string().min(1).default("Bearer"),
});

const userSchema = z.object({
  data: z.object({
    user: z.object({
      avatar_url: z.string().nullable().optional(),
      display_name: z.string().nullable().optional(),
      open_id: z.string().min(1).max(255),
    }),
  }),
  error: z.object({ code: z.literal("ok") }),
});

/**
 * Sign in with TikTok (Login Kit for Web): an SSO adapter for the API
 * config's `authorization.ssoAdapters`. Requests only `user.info.basic` and
 * redirects back to `login/sso/tiktok` under `VITNODE_WEB_URL`, which TikTok
 * requires to be a static HTTPS URL.
 *
 * TikTok calls the client ID a "Client Key". The account id is the `open_id`,
 * unique to your app. TikTok never shares an email address, so a new member
 * confirms one in VitNode by email link. Supplies the avatar for profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { TikTokSSOApiPlugin } from "@vitnode/core/api/adapters/sso/tiktok";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       TikTokSSOApiPlugin({
 *         clientKey: process.env.TIKTOK_CLIENT_KEY,
 *         clientSecret: process.env.TIKTOK_CLIENT_SECRET,
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const TikTokSSOApiPlugin = ({
  clientKey,
  clientSecret,
}: {
  /** The app's Client Key. `undefined` still registers the button, but signing in throws until it is set. */
  clientKey: string | undefined;
  /** The app's Client Secret. Needed to exchange the code. */
  clientSecret: string | undefined;
}): SSOApiPlugin => {
  const id = "tiktok";
  const redirectUri = getRedirectUri(id);

  return {
    brandColor: "#000000",
    icon: TIKTOK_ICON,
    id,
    name: "TikTok",
    profileFields: ["avatar"],
    getUrl: ({ state }) => {
      const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
      url.searchParams.set(
        "client_key",
        requireSsoOption(clientKey, "TikTok", "client key"),
      );
      url.searchParams.set("scope", "user.info.basic");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);

      return url.toString();
    },
    fetchToken: async code =>
      await requestSsoProviderJson({
        init: formPost({
          client_key: requireSsoOption(clientKey, "TikTok", "client key"),
          client_secret: requireSsoOption(
            clientSecret,
            "TikTok",
            "client secret",
          ),
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        schema: tokenSchema,
        step: "token",
        url: "https://open.tiktokapis.com/v2/oauth/token/",
      }),
    fetchUser: async ({ access_token, open_id }) => {
      const url = new URL("https://open.tiktokapis.com/v2/user/info/");
      url.searchParams.set("fields", "open_id,avatar_url,display_name");
      const {
        data: { user },
      } = await requestSsoProviderJson({
        init: { headers: bearerAuth(access_token) },
        schema: userSchema,
        step: "profile",
        url,
      });
      if (typeof open_id === "string" && open_id !== user.open_id) {
        throw ssoProviderFailure("TikTok answered for another account");
      }

      return {
        avatarUrl: user.avatar_url ?? null,
        email: null,
        emailVerified: false,
        id: user.open_id,
        username: user.display_name ?? null,
      };
    },
  };
};
