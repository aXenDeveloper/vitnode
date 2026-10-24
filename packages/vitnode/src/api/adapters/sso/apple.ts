import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import {
  claimBoolean,
  claimString,
  formPost,
  remoteJwks,
  requestSsoProviderJson,
  requireSsoOption,
  verifySsoIdToken,
} from "@/api/lib/sso-protocol";
import { getRedirectUri } from "@/api/models/sso";

import { APPLE_ICON } from "./icons";

const ISSUER = "https://appleid.apple.com";

/** How long a generated client secret lives. Apple allows up to six months. */
export const APPLE_CLIENT_SECRET_TTL_S = 60 * 60 * 24;

/** A cached secret is replaced once it has less than this left. */
const RENEW_BEFORE_S = 60 * 60;

const KEY_ID = /^[A-Z0-9]{10}$/;
const TEAM_ID = /^[A-Z0-9]{10}$/;

const tokenSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1),
  token_type: z.string().min(1),
});

const firstAuthorizationSchema = z.object({
  name: z
    .object({
      firstName: z.string().max(64).optional(),
      lastName: z.string().max(64).optional(),
    })
    .optional(),
});

/**
 * Apple sends the name only on the first authorization, as JSON posted next
 * to the code. Untrusted, and not signed - used for profile fields only.
 */
const nameFromCallback = (
  raw: string | undefined,
): { firstName: null | string; lastName: null | string } => {
  if (!raw) return { firstName: null, lastName: null };

  try {
    const parsed = firstAuthorizationSchema.safeParse(JSON.parse(raw));

    return {
      firstName: claimString(parsed.data?.name?.firstName),
      lastName: claimString(parsed.data?.name?.lastName),
    };
  } catch {
    return { firstName: null, lastName: null };
  }
};

/**
 * Builds Apple's client secret: an ES256 JWT signed with the Sign in with
 * Apple key, valid for {@link APPLE_CLIENT_SECRET_TTL_S}. Server-only.
 */
export const createAppleClientSecret = async ({
  clientId,
  keyId,
  now = new Date(),
  privateKey,
  teamId,
}: {
  clientId: string;
  keyId: string;
  now?: Date;
  /** The `.p8` key's PEM contents. Literal `\n` sequences are accepted. */
  privateKey: string;
  teamId: string;
}): Promise<{ expiresAt: number; secret: string }> => {
  const key = await importPKCS8(
    privateKey.replace(/\\n/g, "\n").trim(),
    "ES256",
  );
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + APPLE_CLIENT_SECRET_TTL_S;
  const secret = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .setAudience(ISSUER)
    .setSubject(clientId)
    .sign(key);

  return { expiresAt, secret };
};

/**
 * Sign in with Apple: an SSO adapter for the API config's
 * `authorization.ssoAdapters`. Requests `name email` with
 * `response_mode=form_post`, so Apple POSTs the callback to
 * `login/sso/apple` under `VITNODE_WEB_URL`; VitNode's request middleware
 * turns that POST into the usual `GET` without loosening any cookie rule.
 *
 * Generates and renews the ES256 client secret from the Team ID, Key ID and
 * `.p8` private key. Validates the ID token (signature, issuer, audience,
 * expiry, nonce). The email - possibly a private relay address, which is a
 * real, verified inbox - is trusted only with `email_verified`. Apple shares
 * the name once, on the first authorization; later sign-ins keep the stored
 * profile. Supplies first and last name for profile sync.
 *
 * Apple only accepts HTTPS return URLs on a real domain - no `localhost`.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { AppleSSOApiPlugin } from "@vitnode/core/api/adapters/sso/apple";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       AppleSSOApiPlugin({
 *         clientId: process.env.APPLE_CLIENT_ID, // the Services ID
 *         teamId: process.env.APPLE_TEAM_ID,
 *         keyId: process.env.APPLE_KEY_ID,
 *         privateKey: process.env.APPLE_PRIVATE_KEY,
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const AppleSSOApiPlugin = ({
  clientId,
  keyId,
  privateKey,
  teamId,
}: {
  /** The Services ID's identifier, e.g. `com.example.web`. `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The 10-character ID of the Sign in with Apple key. */
  keyId: string | undefined;
  /** The `.p8` key file's contents (PEM). Keep it server-side; `\n` escapes are accepted. */
  privateKey: string | undefined;
  /** The 10-character Apple Developer Team ID. */
  teamId: string | undefined;
}): SSOApiPlugin => {
  const id = "apple";
  const redirectUri = getRedirectUri(id);
  let cached: undefined | { expiresAt: number; secret: string };

  const clientSecret = async (): Promise<string> => {
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.expiresAt - now > RENEW_BEFORE_S) return cached.secret;

    const team = requireSsoOption(teamId, "Apple", "team ID");
    const key = requireSsoOption(keyId, "Apple", "key ID");
    if (!(TEAM_ID.test(team) && KEY_ID.test(key))) {
      throw new Error("Apple team ID and key ID are 10 characters each");
    }
    cached = await createAppleClientSecret({
      clientId: requireSsoOption(clientId, "Apple", "client ID"),
      keyId: key,
      privateKey: requireSsoOption(privateKey, "Apple", "private key"),
      teamId: team,
    });

    return cached.secret;
  };

  return {
    brandColor: "#000000",
    icon: APPLE_ICON,
    id,
    name: "Apple",
    profileFields: ["firstName", "lastName"],
    getUrl: ({ nonce, state }) => {
      const url = new URL(`${ISSUER}/auth/authorize`);
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "Apple", "client ID"),
      );
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("response_mode", "form_post");
      url.searchParams.set("scope", "name email");
      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);

      return url.toString();
    },
    fetchToken: async code =>
      await requestSsoProviderJson({
        init: formPost({
          client_id: requireSsoOption(clientId, "Apple", "client ID"),
          client_secret: await clientSecret(),
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        schema: tokenSchema,
        step: "token",
        url: `${ISSUER}/auth/token`,
      }),
    fetchUser: async ({ id_token }, { nonce, params }) => {
      const claims = await verifySsoIdToken({
        audience: requireSsoOption(clientId, "Apple", "client ID"),
        idToken: id_token,
        issuer: ISSUER,
        keys: remoteJwks(`${ISSUER}/auth/keys`),
        nonce,
      });
      const email = claimString(claims.email);
      const { firstName, lastName } = nameFromCallback(params.user);
      const fullName = [firstName, lastName].filter(Boolean).join(" ");

      return {
        email,
        emailVerified:
          email !== null && claimBoolean(claims.email_verified) === true,
        firstName,
        id: String(claims.sub),
        lastName,
        username: fullName || null,
      };
    },
  };
};
