import type { ContentfulStatusCode } from "hono/utils/http-status";

import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import { getRedirectUri } from "@/api/models/sso";

import { FACEBOOK_ICON } from "./icons";

// A provider that stops answering would otherwise hang the sign-in request.
const PROVIDER_TIMEOUT_MS = 10_000;

export const FACEBOOK_GRAPH_VERSION = "v26.0";

const FACEBOOK_USER_FIELDS =
  "id,name,email,first_name,last_name,picture.width(512).height(512){url,is_silhouette}";

/**
 * Sign in with Facebook: an SSO adapter for the API config's
 * `authorization.ssoAdapters`. Requests the `public_profile,email` scopes and
 * redirects back to `login/sso/facebook` under `VITNODE_WEB_URL` - register that URL
 * as the OAuth redirect URI. Supplies the avatar, first and last name for profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { FacebookSSOApiPlugin } from "@vitnode/core/api/adapters/sso/facebook";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       FacebookSSOApiPlugin({
 *         clientId: process.env.FACEBOOK_CLIENT_ID,
 *         clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const FacebookSSOApiPlugin = ({
  clientId,
  clientSecret,
}: {
  /** The OAuth client ID. `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The OAuth client secret. Needed to exchange the code; signing in throws without it. */
  clientSecret: string | undefined;
}): SSOApiPlugin => {
  const id = "facebook";
  const redirectUri = getRedirectUri(id);
  const tokenSchema = z.object({
    access_token: z.string(),
    token_type: z.string(),
  });
  const userSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    picture: z
      .object({
        data: z.object({
          is_silhouette: z.boolean().optional(),
          url: z.string().optional(),
        }),
      })
      .optional(),
  });

  return {
    brandColor: "#0866FF",
    icon: FACEBOOK_ICON,
    id,
    name: "Facebook",
    profileFields: ["avatar", "firstName", "lastName"],
    fetchToken: async code => {
      if (!(clientId && clientSecret)) {
        throw new Error("Missing Facebook client ID or secret");
      }

      const url = new URL(
        `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`,
      );
      url.searchParams.set("code", code);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("client_secret", clientSecret);
      const res = await fetch(url.toString(), {
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

    fetchUser: async ({ access_token }) => {
      const url = new URL(
        `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me`,
      );
      url.searchParams.set("fields", FACEBOOK_USER_FIELDS);
      url.searchParams.set("access_token", access_token);
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new HTTPException(
          +res.status.toString() as ContentfulStatusCode,
          {
            message: "Internal error requesting user",
          },
        );
      }
      const { data: userData, error: userError } = userSchema.safeParse(
        await res.json(),
      );
      if (userError || !userData) {
        throw new HTTPException(400, {
          message: "Invalid user response",
        });
      }

      const picture = userData.picture?.data;

      return {
        avatarUrl:
          picture?.is_silhouette === false ? (picture.url ?? null) : null,
        email: userData.email,
        emailVerified: true,
        firstName: userData.first_name ?? null,
        id: userData.id,
        lastName: userData.last_name ?? null,
        username: userData.name,
      };
    },

    getUrl: ({ state }) => {
      if (!clientId) {
        throw new Error("Missing Facebook client ID");
      }

      const url = new URL(
        `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`,
      );
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "public_profile,email");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);

      return url.toString();
    },
  };
};
