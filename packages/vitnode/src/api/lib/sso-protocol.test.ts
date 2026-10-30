import { HTTPException } from "hono/http-exception";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { z } from "zod";

import {
  basicClientAuth,
  pkceChallengeS256,
  remoteJwks,
  requestSsoProviderJson,
  verifySsoIdToken,
} from "./sso-protocol";

const JWKS_URL = "https://issuer.test/keys";

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwk: Record<string, unknown>;

beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  otherKeys = await generateKeyPair("RS256");
  jwk = { ...(await exportJWK(keys.publicKey)), alg: "RS256", kid: "k1" };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const idToken = async ({
  alg = "RS256",
  audience = "client",
  expiresIn = "5m",
  issuer = "https://issuer.test",
  key = keys.privateKey,
  nonce = "nonce-1",
}: {
  alg?: string;
  audience?: string;
  expiresIn?: number | string;
  issuer?: string;
  key?: CryptoKey;
  /** `null` leaves the claim out. */
  nonce?: null | string;
} = {}) =>
  await new SignJWT(nonce === null ? {} : { nonce })
    .setProtectedHeader({ alg, kid: "k1" })
    .setSubject("user-1")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);

const verify = async (token: string, nonce = "nonce-1") =>
  await verifySsoIdToken({
    audience: "client",
    idToken: token,
    issuer: "https://issuer.test",
    keys: remoteJwks(JWKS_URL),
    nonce,
  });

const statusOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error instanceof HTTPException ? error.status : "not-http";
  }

  return "resolved";
};

describe("validating an ID token", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(Response.json({ keys: [jwk] }, { status: 200 })),
      ),
    );
  });

  it("accepts a token signed by the provider's key, for this client, with this nonce", async () => {
    expect(await verify(await idToken())).toMatchObject({
      nonce: "nonce-1",
      sub: "user-1",
    });
  });

  it.each([
    ["another key's signature", () => ({ key: otherKeys.privateKey })],
    ["another issuer", () => ({ issuer: "https://evil.test" })],
    ["another audience", () => ({ audience: "someone-else" })],
    [
      "an expired token",
      () => ({ expiresIn: Math.floor(Date.now() / 1000) - 120 }),
    ],
  ])("refuses %s", async (_, options) => {
    expect(await statusOf(verify(await idToken(options())))).toBe(400);
  });

  it("refuses a nonce from another attempt, or none at all", async () => {
    expect(await statusOf(verify(await idToken(), "nonce-2"))).toBe(400);
    expect(await statusOf(verify(await idToken({ nonce: null })))).toBe(400);
  });

  it("refuses an algorithm the provider does not sign with", async () => {
    const secret = new TextEncoder().encode("a".repeat(32));
    const token = await new SignJWT({ nonce: "nonce-1" })
      .setProtectedHeader({ alg: "HS256", kid: "k1" })
      .setSubject("user-1")
      .setIssuer("https://issuer.test")
      .setAudience("client")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(secret);

    expect(await statusOf(verify(token))).toBe(400);
  });

  it("checks an issuer that depends on the token, such as Microsoft's tenant", async () => {
    const token = await idToken({ issuer: "https://login.test/tenant-a/v2.0" });
    const check = async (allowed: string) =>
      await verifySsoIdToken({
        audience: "client",
        idToken: token,
        issuer: payload => payload.iss === allowed,
        keys: remoteJwks(JWKS_URL),
        nonce: "nonce-1",
      });

    expect(await statusOf(check("https://login.test/tenant-a/v2.0"))).toBe(
      "resolved",
    );
    expect(await statusOf(check("https://login.test/tenant-b/v2.0"))).toBe(400);
  });

  it("refuses a missing ID token", async () => {
    expect(await statusOf(verify(undefined as never))).toBe(400);
  });
});

describe("calling a provider", () => {
  const schema = z.object({ access_token: z.string() });

  it.each([
    [
      "an error status",
      async () => Promise.resolve(new Response("{}", { status: 401 })),
    ],
    [
      "a body that is not JSON",
      async () => Promise.resolve(new Response("<html>")),
    ],
    [
      "a body of the wrong shape",
      async () => Promise.resolve(Response.json({ error: "invalid_grant" })),
    ],
    [
      "a timeout",
      async () => Promise.reject(new DOMException("timeout", "TimeoutError")),
    ],
  ])(
    "fails with a 502 on %s, without echoing the provider",
    async (_, answer) => {
      vi.stubGlobal("fetch", vi.fn(answer));

      const failure = requestSsoProviderJson({
        schema,
        step: "token",
        url: "https://provider.test/token",
      });

      await expect(failure).rejects.toThrow(
        /^(Provider token request failed|Invalid provider token response)$/,
      );
      expect(await statusOf(failure)).toBe(502);
    },
  );

  it("bounds every request with a timeout", async () => {
    const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) =>
      Promise.resolve(Response.json({ access_token: "a" })),
    );
    vi.stubGlobal("fetch", fetch);

    await requestSsoProviderJson({
      schema,
      step: "token",
      url: "https://provider.test/token",
    });

    expect(fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("client authentication and PKCE", () => {
  it("encodes the S256 challenge from RFC 7636's example", () => {
    expect(
      pkceChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("form-encodes the client credentials of HTTP Basic", () => {
    expect(basicClientAuth("id:1", "s&cret")).toEqual({
      Authorization: `Basic ${Buffer.from("id%3A1:s%26cret").toString("base64")}`,
    });
  });
});
