import type { z } from "zod";

import { HTTPException } from "hono/http-exception";
import {
  createRemoteJWKSet,
  errors as joseErrors,
  type JWTPayload,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import crypto from "node:crypto";

/** How long core waits for a provider before failing the sign-in. */
export const SSO_PROVIDER_TIMEOUT_MS = 10_000;

/** A random, URL-safe secret: a PKCE verifier, a nonce or a state. */
export const randomSsoSecret = (bytes = 32): string =>
  crypto.randomBytes(bytes).toString("base64url");

/** The `S256` PKCE challenge of a verifier (RFC 7636). */
export const pkceChallengeS256 = (verifier: string): string =>
  crypto.createHash("sha256").update(verifier).digest("base64url");

/** SHA-256 of a secret as hex, for storing a lookup key instead of the secret. */
export const hashSsoSecret = (secret: string): string =>
  crypto.createHash("sha256").update(secret).digest("hex");

/** Compares two strings without leaking where they differ. */
export const timingSafeEqualText = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/** A `502` for a provider that answered, but not as it should. */
export const ssoProviderFailure = (message: string) =>
  new HTTPException(502, { message });

/**
 * Calls a provider endpoint and validates its JSON answer with `schema`.
 * Bounded by {@link SSO_PROVIDER_TIMEOUT_MS}. A timeout, a non-2xx status, a
 * body that is not JSON or one that fails the schema all throw a `502`
 * `HTTPException` whose message never echoes the provider's body.
 *
 * Server-only.
 */
export const requestSsoProviderJson = async <TValue>({
  init,
  schema,
  step,
  url,
}: {
  init?: RequestInit;
  schema: z.ZodType<TValue>;
  /** What the request is for, used in the error message (e.g. `"token"`). */
  step: string;
  url: string | URL;
}): Promise<TValue> => {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
      redirect: "error",
      signal: AbortSignal.timeout(SSO_PROVIDER_TIMEOUT_MS),
    });
  } catch {
    throw ssoProviderFailure(`Provider ${step} request failed`);
  }

  if (!response.ok) {
    throw ssoProviderFailure(`Provider ${step} request failed`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw ssoProviderFailure(`Invalid provider ${step} response`);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw ssoProviderFailure(`Invalid provider ${step} response`);
  }

  return parsed.data;
};

/** Form-encoded POST options for a token endpoint. */
export const formPost = (
  body: Record<string, string | undefined>,
  headers: Record<string, string> = {},
): RequestInit => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) params.set(key, value);
  }

  return {
    body: params,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    method: "POST",
  };
};

/** An HTTP Basic `Authorization` header for a client ID and secret (RFC 6749 §2.3.1). */
export const basicClientAuth = (
  clientId: string,
  clientSecret: string,
): Record<string, string> => ({
  Authorization: `Basic ${Buffer.from(
    `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`,
  ).toString("base64")}`,
});

/** An OAuth bearer `Authorization` header (RFC 6750). */
export const bearerAuth = (accessToken: string): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
});

const jwksSets = new Map<string, JWTVerifyGetKey>();

/**
 * The provider's signing keys, fetched lazily and cached per URL by `jose`
 * (refreshed when an unknown key ID shows up).
 */
export const remoteJwks = (url: string): JWTVerifyGetKey => {
  let set = jwksSets.get(url);
  if (!set) {
    set = createRemoteJWKSet(new URL(url), {
      timeoutDuration: SSO_PROVIDER_TIMEOUT_MS,
    });
    jwksSets.set(url, set);
  }

  return set;
};

/**
 * Validates an OpenID Connect ID token with `jose`: the signature against the
 * provider's keys, the allowed algorithms, `iss`, `aud`, `exp`/`iat` (with a
 * minute of clock tolerance) and, when one was sent, the `nonce`. Any failure
 * throws a `400` `HTTPException`.
 *
 * `issuer` is either the exact value or a predicate, for providers such as
 * Microsoft whose issuer embeds the account's tenant.
 *
 * Server-only.
 */
export const verifySsoIdToken = async ({
  algorithms = ["RS256"],
  audience,
  idToken,
  issuer,
  keys,
  nonce,
}: {
  algorithms?: string[];
  audience: string;
  idToken: unknown;
  issuer: ((payload: JWTPayload) => boolean) | string;
  keys: JWTVerifyGetKey | Parameters<typeof jwtVerify>[1];
  /** The nonce sent with the authorization request. Required in the token when set. */
  nonce?: string;
}): Promise<JWTPayload> => {
  if (typeof idToken !== "string" || idToken.length === 0) {
    throw new HTTPException(400, { message: "Missing ID token" });
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, keys as JWTVerifyGetKey, {
      algorithms,
      audience,
      clockTolerance: 60,
      issuer: typeof issuer === "string" ? issuer : undefined,
      requiredClaims: ["exp", "iat", "sub"],
    }));
  } catch (error) {
    if (
      error instanceof joseErrors.JWKSTimeout ||
      (error instanceof joseErrors.JOSEError &&
        error.code === "ERR_JOSE_GENERIC")
    ) {
      throw ssoProviderFailure("Provider keys request failed");
    }

    throw new HTTPException(400, { message: "Invalid ID token" });
  }

  if (typeof issuer === "function" && !issuer(payload)) {
    throw new HTTPException(400, { message: "Invalid ID token issuer" });
  }

  if (
    nonce !== undefined &&
    !(
      typeof payload.nonce === "string" &&
      timingSafeEqualText(payload.nonce, nonce)
    )
  ) {
    throw new HTTPException(400, { message: "Invalid ID token nonce" });
  }

  return payload;
};

/** `true`/`"true"` as `true`, `false`/`"false"` as `false`, anything else as `undefined`. Apple sends booleans as strings. */
export const claimBoolean = (value: unknown): boolean | undefined => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;

  return undefined;
};

/** A non-empty string claim, or `null`. */
export const claimString = (value: unknown): null | string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

/**
 * Reads a configuration value that must be present to sign in. Throws a plain
 * `Error` naming the missing option - the button still renders, and the error
 * reaches the server log instead of the visitor.
 */
export const requireSsoOption = (
  value: string | undefined,
  provider: string,
  option: string,
): string => {
  if (!value) throw new Error(`Missing ${provider} ${option}`);

  return value;
};
