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

import { GITLAB_ICON } from "./icons";

/** GitLab.com's issuer, the default. */
export const GITLAB_COM_ISSUER = "https://gitlab.com";

const PROVIDER_ID = /^[\w-]{1,64}$/;

const LOCAL_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

const tokenSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1),
  token_type: z.string().min(1),
});

const userInfoSchema = z.object({
  email: z.string().nullable().optional(),
  email_verified: z.boolean().nullable().optional(),
  family_name: z.string().nullable().optional(),
  given_name: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
  picture: z.string().nullable().optional(),
  sub: z.string().min(1),
});

/**
 * A GitLab instance's issuer, normalized: HTTPS (plain HTTP only for
 * localhost), no query, fragment or trailing slash. A relative URL root
 * (`https://example.com/gitlab`) is kept.
 *
 * @throws When the URL is not one.
 */
export const normalizeGitLabIssuer = (issuer: string): string => {
  let url: URL;
  try {
    url = new URL(issuer);
  } catch {
    throw new Error(`Invalid GitLab issuer "${issuer}"`);
  }
  const secure =
    url.protocol === "https:" ||
    (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  if (!secure || url.search || url.hash || url.username || url.password) {
    throw new Error(
      `Invalid GitLab issuer "${issuer}" - use the instance's HTTPS URL, e.g. https://gitlab.example.com`,
    );
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
};

/**
 * Sign in with GitLab - GitLab.com or a self-managed instance: an SSO adapter
 * for the API config's `authorization.ssoAdapters`, using OpenID Connect with
 * PKCE. Requests `openid profile email`, validates the ID token (signature,
 * issuer, audience, expiry, nonce) and redirects back to `login/sso/{id}`
 * under `VITNODE_WEB_URL`.
 *
 * GitLab user IDs are only unique within an instance, so for any issuer but
 * GitLab.com the stored account id is `{issuer}:{sub}`. To offer two instances
 * side by side, register the adapter twice with different `id`s. Supplies the
 * avatar, first and last name for profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { GitLabSSOApiPlugin } from "@vitnode/core/api/adapters/sso/gitlab";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       GitLabSSOApiPlugin({
 *         clientId: process.env.GITLAB_CLIENT_ID,
 *         clientSecret: process.env.GITLAB_CLIENT_SECRET,
 *         // issuer: "https://gitlab.example.com", // self-managed
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const GitLabSSOApiPlugin = ({
  clientId,
  clientSecret,
  id = "gitlab",
  issuer = GITLAB_COM_ISSUER,
  name = "GitLab",
}: {
  /** The application's Application ID. `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The application's Secret. Needed to exchange the code. */
  clientSecret: string | undefined;
  /** The provider id, used in the callback URL (`login/sso/{id}`) and to store accounts. Defaults to `gitlab`. */
  id?: string;
  /**
   * The instance URL, which is also its OpenID Connect issuer. Defaults to
   * `https://gitlab.com`. Must be HTTPS (HTTP only for localhost).
   */
  issuer?: string;
  /** The button label's provider name. Defaults to `GitLab`. */
  name?: string;
}): SSOApiPlugin => {
  if (!PROVIDER_ID.test(id)) {
    throw new Error(
      `Invalid GitLab provider id "${id}" - letters, digits, _ and -`,
    );
  }
  const base = normalizeGitLabIssuer(issuer);
  const redirectUri = getRedirectUri(id);
  const namespace =
    base === GITLAB_COM_ISSUER ? null : base.replace(/^https?:\/\//, "");

  return {
    icon: GITLAB_ICON,
    id,
    name,
    profileFields: ["avatar", "firstName", "lastName"],
    getUrl: ({ codeChallenge, codeChallengeMethod, nonce, state }) => {
      const url = new URL(`${base}/oauth/authorize`);
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "GitLab", "client ID"),
      );
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid profile email");
      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", codeChallengeMethod);

      return url.toString();
    },
    fetchToken: async (code, { codeVerifier }) =>
      await requestSsoProviderJson({
        init: formPost({
          client_id: requireSsoOption(clientId, "GitLab", "client ID"),
          client_secret: requireSsoOption(
            clientSecret,
            "GitLab",
            "client secret",
          ),
          code,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        schema: tokenSchema,
        step: "token",
        url: `${base}/oauth/token`,
      }),
    fetchUser: async ({ access_token, id_token }, { nonce }) => {
      const claims = await verifySsoIdToken({
        audience: requireSsoOption(clientId, "GitLab", "client ID"),
        idToken: id_token,
        issuer: base,
        keys: remoteJwks(`${base}/oauth/discovery/keys`),
        nonce,
      });
      const info = await requestSsoProviderJson({
        init: { headers: bearerAuth(access_token) },
        schema: userInfoSchema,
        step: "profile",
        url: `${base}/oauth/userinfo`,
      });
      if (info.sub !== claims.sub) {
        throw ssoProviderFailure(
          "GitLab UserInfo answered for another account",
        );
      }

      const email = claimString(info.email);

      return {
        avatarUrl: info.picture ?? null,
        email,
        emailVerified: email !== null && info.email_verified === true,
        firstName: info.given_name ?? null,
        id: namespace ? `${namespace}:${info.sub}` : info.sub,
        lastName: info.family_name ?? null,
        username: info.nickname ?? info.name ?? null,
      };
    },
  };
};
