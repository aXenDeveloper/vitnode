import { hashSessionToken } from "../../session-token";

/**
 * Prefixes of the secrets VitNode issues to MCP clients, so secret scanners
 * (GitHub, GitGuardian) can recognise a leaked one.
 */
export const MCP_SECRET_PREFIX = {
  accessToken: "vnmcp_at_",
  code: "vnmcp_code_",
  refreshToken: "vnmcp_rt_",
} as const;

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/** `byteLength` random bytes from Web Crypto, base64url without padding. */
export const randomBase64Url = (byteLength = 32): string =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));

/** A new secret: the prefix plus 32 random bytes. */
export const generateMcpSecret = (
  kind: keyof typeof MCP_SECRET_PREFIX,
): string => `${MCP_SECRET_PREFIX[kind]}${randomBase64Url(32)}`;

/** The stored form of a code or token: SHA-256, lowercase hex. */
export const hashMcpSecret = async (secret: string): Promise<string> =>
  await hashSessionToken(secret);

/** The PKCE `S256` challenge of a verifier (RFC 7636 §4.2). */
export const pkceS256Challenge = async (verifier: string): Promise<string> =>
  toBase64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );

/**
 * Compares two strings in time that depends only on their lengths, never on
 * where they first differ. Web Crypto has no such primitive on every runtime,
 * so it is done by hand.
 */
export const constantTimeEqual = (a: string, b: string): boolean => {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }

  return diff === 0;
};

/** RFC 7636 §4.1: 43-128 characters of the unreserved set. */
export const isValidCodeVerifier = (value: string): boolean =>
  /^[A-Za-z0-9\-._~]{43,128}$/.test(value);

/** An `S256` challenge: exactly 43 base64url characters (32 bytes). */
export const isValidCodeChallenge = (value: string): boolean =>
  /^[A-Za-z0-9_-]{43}$/.test(value);
