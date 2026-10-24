import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import {
  bearerAuth,
  claimBoolean,
  claimString,
  formPost,
  remoteJwks,
  requestSsoProviderJson,
  requireSsoOption,
  ssoProviderFailure,
  verifySsoIdToken,
} from "@/api/lib/sso-protocol";
import { getRedirectUri } from "@/api/models/sso";

import { MICROSOFT_ICON } from "./icons";

const AUTHORITY = "https://login.microsoftonline.com";

/** The tenant every personal Microsoft account signs in through. */
export const MICROSOFT_CONSUMERS_TENANT_ID =
  "9188040d-6c67-4c5b-b112-36a304b66dad";

const GUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/**
 * Who may sign in: `common` (work, school and personal accounts),
 * `organizations` (work and school only), `consumers` (personal only) or one
 * tenant's ID.
 */
export type MicrosoftTenant =
  | "common"
  | "consumers"
  | "organizations"
  | (string & {});

const tokenSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1),
  token_type: z.string().min(1),
});

const userInfoSchema = z.object({
  family_name: z.string().nullable().optional(),
  given_name: z.string().nullable().optional(),
  sub: z.string().min(1),
});

/**
 * Whether the tenant an ID token came from (`tid`) may sign in. Enforced on
 * the validated token: the authorize URL's tenant is only a suggestion to
 * Microsoft, and `common` accepts any tenant at all.
 */
export const microsoftTenantAllowed = ({
  allowedTenantIds,
  tenant,
  tid,
}: {
  allowedTenantIds?: readonly string[];
  tenant: MicrosoftTenant;
  tid: string;
}): boolean => {
  const id = tid.toLowerCase();
  if (
    allowedTenantIds &&
    !allowedTenantIds.some(one => one.toLowerCase() === id)
  ) {
    return false;
  }

  if (tenant === "common") return true;
  if (tenant === "consumers") return id === MICROSOFT_CONSUMERS_TENANT_ID;
  if (tenant === "organizations") return id !== MICROSOFT_CONSUMERS_TENANT_ID;

  return id === tenant.toLowerCase();
};

/**
 * Sign in with Microsoft (Microsoft Entra ID and personal Microsoft accounts):
 * an SSO adapter for the API config's `authorization.ssoAdapters`, using
 * OpenID Connect with PKCE. Requests `openid profile email`, validates the ID
 * token (signature, audience, expiry, nonce, and an issuer matching the
 * token's own tenant), enforces `tenant` and `allowedTenantIds`, and redirects
 * back to `login/sso/microsoft` under `VITNODE_WEB_URL`.
 *
 * The account id is `{tid}:{oid}`, as Microsoft recommends. Microsoft's
 * `email` claim is mutable and often unverified, so it is trusted only with
 * `xms_edov: true` (domain owner verified); otherwise a new member confirms an
 * address in VitNode by email link. Supplies first and last name for profile
 * sync - the photo would need Microsoft Graph's `User.Read`, which this
 * adapter does not request.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { MicrosoftSSOApiPlugin } from "@vitnode/core/api/adapters/sso/microsoft";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       MicrosoftSSOApiPlugin({
 *         clientId: process.env.MICROSOFT_CLIENT_ID,
 *         clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
 *         tenant: "common",
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const MicrosoftSSOApiPlugin = ({
  allowedTenantIds,
  clientId,
  clientSecret,
  tenant = "common",
}: {
  /** Optional allowlist of tenant IDs (GUIDs), checked against every ID token on top of `tenant`. */
  allowedTenantIds?: readonly string[];
  /** The app registration's Application (client) ID. `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** A client secret's Value (not its ID). Needed to exchange the code. */
  clientSecret: string | undefined;
  /**
   * Which accounts may sign in - match the registration's "Supported account
   * types". `common`, `organizations`, `consumers` or a tenant ID (GUID).
   * Defaults to `common`.
   *
   * @throws When it is none of these - a domain name is not accepted, use
   * the tenant ID.
   */
  tenant?: MicrosoftTenant;
}): SSOApiPlugin => {
  const id = "microsoft";
  const redirectUri = getRedirectUri(id);
  if (
    !["common", "consumers", "organizations"].includes(tenant) &&
    !GUID.test(tenant)
  ) {
    throw new Error(
      `Invalid Microsoft tenant "${tenant}" - use "common", "organizations", "consumers" or a tenant ID`,
    );
  }
  if (allowedTenantIds?.some(one => !GUID.test(one))) {
    throw new Error("Microsoft allowedTenantIds must be tenant IDs (GUIDs)");
  }

  return {
    icon: MICROSOFT_ICON,
    id,
    name: "Microsoft",
    profileFields: ["firstName", "lastName"],
    getUrl: ({ codeChallenge, codeChallengeMethod, nonce, state }) => {
      const url = new URL(`${AUTHORITY}/${tenant}/oauth2/v2.0/authorize`);
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "Microsoft", "client ID"),
      );
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_mode", "query");
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
          client_id: requireSsoOption(clientId, "Microsoft", "client ID"),
          client_secret: requireSsoOption(
            clientSecret,
            "Microsoft",
            "client secret",
          ),
          code,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        schema: tokenSchema,
        step: "token",
        url: `${AUTHORITY}/${tenant}/oauth2/v2.0/token`,
      }),
    fetchUser: async ({ access_token, id_token }, { nonce }) => {
      const claims = await verifySsoIdToken({
        audience: requireSsoOption(clientId, "Microsoft", "client ID"),
        idToken: id_token,
        // Multi-tenant metadata publishes `.../{tenantid}/v2.0`: the issuer
        // must name the very tenant the token says it came from.
        issuer: payload =>
          typeof payload.tid === "string" &&
          GUID.test(payload.tid) &&
          payload.iss === `${AUTHORITY}/${payload.tid}/v2.0`,
        keys: remoteJwks(`${AUTHORITY}/${tenant}/discovery/v2.0/keys`),
        nonce,
      });
      const tid = String(claims.tid);
      if (!microsoftTenantAllowed({ allowedTenantIds, tenant, tid })) {
        throw new HTTPException(403, { message: "Tenant not allowed" });
      }

      const oid = claimString(claims.oid);
      if (!oid) throw ssoProviderFailure("Microsoft ID token without oid");

      const info = await requestSsoProviderJson({
        init: { headers: bearerAuth(access_token) },
        schema: userInfoSchema,
        step: "profile",
        url: "https://graph.microsoft.com/oidc/userinfo",
      });
      if (info.sub !== claims.sub) {
        throw ssoProviderFailure(
          "Microsoft UserInfo answered for another account",
        );
      }

      const email = claimString(claims.email);

      return {
        email,
        emailVerified: email !== null && claimBoolean(claims.xms_edov) === true,
        firstName: info.given_name ?? null,
        id: `${tid.toLowerCase()}:${oid.toLowerCase()}`,
        lastName: info.family_name ?? null,
        username: claimString(claims.name),
      };
    },
  };
};
