import type { ContentfulStatusCode } from "hono/utils/http-status";

import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import { getRedirectUri } from "@/api/models/sso";

import { DISCORD_ICON } from "./icons";

// A provider that stops answering would otherwise hang the sign-in request.
const PROVIDER_TIMEOUT_MS = 10_000;

const DISCORD_AVATAR_HASH = /^(?:a_)?[\da-f]{16,64}$/i;

const discordAvatarUrl = ({
  avatar,
  id,
}: {
  avatar?: null | string;
  id: string;
}): null | string => {
  if (!(avatar && DISCORD_AVATAR_HASH.test(avatar) && /^\d+$/.test(id))) {
    return null;
  }

  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=512`;
};

/**
 * Sign in with Discord: an SSO adapter for the API config's
 * `authorization.ssoAdapters`. Requests the `identify email` scopes and
 * redirects back to `login/sso/discord` under `VITNODE_WEB_URL` - register that URL
 * as the OAuth redirect URI. Refuses (`400`) a Discord account whose email is not verified. Supplies the avatar for profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { DiscordSSOApiPlugin } from "@vitnode/core/api/adapters/sso/discord";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       DiscordSSOApiPlugin({
 *         clientId: process.env.DISCORD_CLIENT_ID,
 *         clientSecret: process.env.DISCORD_CLIENT_SECRET,
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const DiscordSSOApiPlugin = ({
  clientId = "",
  clientSecret = "",
}: {
  /** The OAuth client ID. `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The OAuth client secret. Needed to exchange the code; signing in throws without it. */
  clientSecret: string | undefined;
}): SSOApiPlugin => {
  const id = "discord";
  const redirectUri = getRedirectUri(id);
  const userSchema = z.object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
    verified: z.boolean(),
    avatar: z.string().nullable().optional(),
  });
  const tokenSchema = z.object({
    access_token: z.string(),
    token_type: z.string(),
  });

  return {
    fetchToken: async code => {
      if (!(clientId && clientSecret)) {
        throw new Error("Missing Discord client ID or secret");
      }

      const res = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new HTTPException(
          +res.status.toString() as ContentfulStatusCode,
          {
            message: "Internal error requesting token",
          },
        );
      }

      const { data, error } = tokenSchema.safeParse(await res.json());
      if (error || !data) {
        throw new HTTPException(400, {
          message: "Invalid token response",
        });
      }

      return data;
    },
    fetchUser: async ({ token_type, access_token }) => {
      const res = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `${token_type} ${access_token}`,
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
      const { data, error } = userSchema.safeParse(await res.json());
      if (error || !data) {
        throw new HTTPException(400, {
          message: "Invalid user response",
        });
      }

      // As the Google adapter does. An address Discord has not confirmed is an
      // address the person signing in may not own, and VitNode keys an account
      // on it - so accepting one lets somebody register under an address they
      // cannot read, and hold the account the real owner would have had.
      if (!data.verified) {
        throw new HTTPException(400, {
          message: "Email not verified",
        });
      }

      return {
        avatarUrl: discordAvatarUrl(data),
        email: data.email,
        id: data.id,
        username: data.username,
      };
    },
    getUrl: ({ state }) => {
      if (!clientId) {
        throw new Error("Missing Discord client ID");
      }

      const url = new URL("https://discord.com/oauth2/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "identify email");
      url.searchParams.set("state", state);

      return url.toString();
    },
    brandColor: "#5865F2",
    icon: DISCORD_ICON,
    id,
    name: "Discord",
    profileFields: ["avatar"],
  };
};
