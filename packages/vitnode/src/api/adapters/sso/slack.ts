import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import {
  claimString,
  formPost,
  remoteJwks,
  requestSsoProviderJson,
  requireSsoOption,
  ssoProviderFailure,
  verifySsoIdToken,
} from "@/api/lib/sso-protocol";
import { getRedirectUri } from "@/api/models/sso";

import { SLACK_ICON } from "./icons";

const ISSUER = "https://slack.com";

const TEAM_ID = /^[TE][A-Z0-9]{2,20}$/;

const tokenSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1),
  ok: z.literal(true),
  token_type: z.string().min(1),
});

/**
 * Sign in with Slack: an SSO adapter for the API config's
 * `authorization.ssoAdapters`, using Slack's OpenID Connect flow - no bot is
 * installed and no workspace data is read. Requests `openid profile email`,
 * validates the ID token (signature, issuer, audience, expiry, nonce) and
 * redirects back to `login/sso/slack` under `VITNODE_WEB_URL`.
 *
 * Slack user IDs are only unique within a workspace, so the stored account id
 * is `{team_id}:{user_id}`. With `teamId` set, only members of that workspace
 * can sign in - checked on the ID token, not just suggested to Slack. Supplies
 * the avatar, first and last name for profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { SlackSSOApiPlugin } from "@vitnode/core/api/adapters/sso/slack";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       SlackSSOApiPlugin({
 *         clientId: process.env.SLACK_CLIENT_ID,
 *         clientSecret: process.env.SLACK_CLIENT_SECRET,
 *         teamId: process.env.SLACK_TEAM_ID, // optional
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const SlackSSOApiPlugin = ({
  clientId,
  clientSecret,
  teamId,
}: {
  /** The app's Client ID (Basic Information → App Credentials). `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The app's Client Secret. Needed to exchange the code. */
  clientSecret: string | undefined;
  /**
   * Restrict sign-in to one workspace, by its ID (`T…`, or `E…` for an
   * Enterprise organization). Preselects it on Slack's screen and rejects
   * (`403`) an ID token from any other workspace. Leave unset to accept
   * every workspace.
   */
  teamId?: string;
}): SSOApiPlugin => {
  const id = "slack";
  const redirectUri = getRedirectUri(id);
  const team = claimString(teamId) ?? undefined;
  if (team !== undefined && !TEAM_ID.test(team)) {
    throw new Error(
      `Invalid Slack teamId "${team}" - expected an ID like T0123ABCD`,
    );
  }

  return {
    icon: SLACK_ICON,
    id,
    name: "Slack",
    profileFields: ["avatar", "firstName", "lastName"],
    getUrl: ({ nonce, state }) => {
      const url = new URL(`${ISSUER}/openid/connect/authorize`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid profile email");
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "Slack", "client ID"),
      );
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);
      if (team) url.searchParams.set("team", team);

      return url.toString();
    },
    fetchToken: async code =>
      await requestSsoProviderJson({
        init: formPost({
          client_id: requireSsoOption(clientId, "Slack", "client ID"),
          client_secret: requireSsoOption(
            clientSecret,
            "Slack",
            "client secret",
          ),
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        schema: tokenSchema,
        step: "token",
        url: `${ISSUER}/api/openid.connect.token`,
      }),
    fetchUser: async ({ id_token }, { nonce }) => {
      const claims = await verifySsoIdToken({
        audience: requireSsoOption(clientId, "Slack", "client ID"),
        idToken: id_token,
        issuer: ISSUER,
        keys: remoteJwks(`${ISSUER}/openid/connect/keys`),
        nonce,
      });
      const teamOf = claimString(claims["https://slack.com/team_id"]);
      const userOf = claimString(claims["https://slack.com/user_id"]);
      if (!(teamOf && userOf)) {
        throw ssoProviderFailure("Slack ID token without a workspace or user");
      }
      if (team && teamOf !== team) {
        throw new HTTPException(403, { message: "Workspace not allowed" });
      }

      const email = claimString(claims.email);

      return {
        avatarUrl: claimString(claims.picture),
        email,
        emailVerified: email !== null && claims.email_verified === true,
        firstName: claimString(claims.given_name),
        id: `${teamOf}:${userOf}`,
        lastName: claimString(claims.family_name),
        username: claimString(claims.name),
      };
    },
  };
};
