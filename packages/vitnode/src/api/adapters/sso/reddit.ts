import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import {
  basicClientAuth,
  bearerAuth,
  formPost,
  requestSsoProviderJson,
  requireSsoOption,
} from "@/api/lib/sso-protocol";
import { getRedirectUri } from "@/api/models/sso";

import { REDDIT_ICON } from "./icons";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
});

const meSchema = z.object({
  icon_img: z.string().nullable().optional(),
  id: z.string().regex(/^[\da-z]{1,32}$/),
  name: z.string().min(1),
  snoovatar_img: z.string().nullable().optional(),
});

/** Reddit escapes `&` in image URLs as `&amp;`. */
const unescapeUrl = (value: null | string | undefined): null | string =>
  value ? value.replaceAll("&amp;", "&") : null;

/**
 * Sign in with Reddit: an SSO adapter for the API config's
 * `authorization.ssoAdapters`. Requests only the `identity` scope - no
 * posting, voting or moderation - with a temporary (one-hour, no refresh)
 * token, and redirects back to `login/sso/reddit` under `VITNODE_WEB_URL`.
 *
 * Reddit never shares an email address, so a new member confirms one in
 * VitNode by email link, and a returning member signs in by their Reddit
 * account ID. Supplies the avatar for profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { RedditSSOApiPlugin } from "@vitnode/core/api/adapters/sso/reddit";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       RedditSSOApiPlugin({
 *         clientId: process.env.REDDIT_CLIENT_ID,
 *         clientSecret: process.env.REDDIT_CLIENT_SECRET,
 *         userAgent: "web:com.example.forum:1.0.0 (by /u/your_username)",
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const RedditSSOApiPlugin = ({
  clientId,
  clientSecret,
  userAgent,
}: {
  /** The "web app"'s client ID (under its name on reddit.com/prefs/apps). `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The app's secret. Needed to exchange the code. */
  clientSecret: string | undefined;
  /**
   * The `User-Agent` sent to Reddit, which throttles generic ones. Reddit asks
   * for `<platform>:<app ID>:<version> (by /u/<username>)`. Defaults to
   * `web:<clientId>:1.0 (by VitNode)`.
   */
  userAgent?: string;
}): SSOApiPlugin => {
  const id = "reddit";
  const redirectUri = getRedirectUri(id);
  const agent = () =>
    userAgent ??
    `web:${requireSsoOption(clientId, "Reddit", "client ID")}:1.0 (by VitNode)`;

  return {
    icon: REDDIT_ICON,
    id,
    name: "Reddit",
    profileFields: ["avatar"],
    getUrl: ({ state }) => {
      const url = new URL("https://www.reddit.com/api/v1/authorize");
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "Reddit", "client ID"),
      );
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("duration", "temporary");
      url.searchParams.set("scope", "identity");

      return url.toString();
    },
    fetchToken: async code =>
      await requestSsoProviderJson({
        init: formPost(
          { code, grant_type: "authorization_code", redirect_uri: redirectUri },
          {
            ...basicClientAuth(
              requireSsoOption(clientId, "Reddit", "client ID"),
              requireSsoOption(clientSecret, "Reddit", "client secret"),
            ),
            "User-Agent": agent(),
          },
        ),
        schema: tokenSchema,
        step: "token",
        url: "https://www.reddit.com/api/v1/access_token",
      }),
    fetchUser: async ({ access_token }) => {
      const me = await requestSsoProviderJson({
        init: {
          headers: { ...bearerAuth(access_token), "User-Agent": agent() },
        },
        schema: meSchema,
        step: "profile",
        url: "https://oauth.reddit.com/api/v1/me",
      });

      return {
        avatarUrl: unescapeUrl(me.snoovatar_img) ?? unescapeUrl(me.icon_img),
        email: null,
        emailVerified: false,
        id: me.id,
        username: me.name,
      };
    },
  };
};
