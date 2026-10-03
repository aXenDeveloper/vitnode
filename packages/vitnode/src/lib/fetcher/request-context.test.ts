import { describe, expect, it } from "vitest";

import {
  buildForwardedHeaders,
  CAPTCHA_TOKEN_HEADER,
  FORWARDED_IP_FALLBACK,
  FORWARDED_USER_AGENT_FALLBACK,
  resolveVisitorIp,
} from "./request-context";

describe("buildForwardedHeaders", () => {
  it("forwards the cookie header verbatim", () => {
    expect(
      buildForwardedHeaders({
        cookie: "vitnode_auth=abc; vitnode_device=def",
      }).Cookie,
    ).toBe("vitnode_auth=abc; vitnode_device=def");
  });

  it("falls back for a caller with no user-agent or forwarded ip", () => {
    expect(buildForwardedHeaders({})).toStrictEqual({
      Cookie: "",
      "user-agent": FORWARDED_USER_AGENT_FALLBACK,
      "x-forwarded-for": FORWARDED_IP_FALLBACK,
    });
  });

  it("keeps an x-forwarded-for chain intact", () => {
    expect(
      buildForwardedHeaders({ forwardedFor: "203.0.113.7, 10.0.0.1" })[
        "x-forwarded-for"
      ],
    ).toBe("203.0.113.7, 10.0.0.1");
  });

  it("adds the captcha token only when there is one", () => {
    expect(buildForwardedHeaders({})).not.toHaveProperty(CAPTCHA_TOKEN_HEADER);
    expect(buildForwardedHeaders({ captchaToken: "solved" })).toHaveProperty(
      CAPTCHA_TOKEN_HEADER,
      "solved",
    );
    expect(buildForwardedHeaders({ captchaToken: "" })).not.toHaveProperty(
      CAPTCHA_TOKEN_HEADER,
    );
  });

  it("never forwards anything outside the allowlist", () => {
    // The guard for the whole point of this module: a header the API trusts
    // (`origin`, `host`, `authorization`) must not be reachable through it.
    expect(
      Object.keys(
        buildForwardedHeaders({
          captchaToken: "solved",
          cookie: "vitnode_auth=abc",
          forwardedFor: "203.0.113.7",
          userAgent: "Mozilla/5.0",
        }),
      ).sort(),
    ).toStrictEqual([
      "Cookie",
      "user-agent",
      "x-forwarded-for",
      CAPTCHA_TOKEN_HEADER,
    ]);
  });
});

describe("resolveVisitorIp", () => {
  it("uses the socket address and ignores the header when no proxy is trusted", () => {
    expect(
      resolveVisitorIp({
        forwardedFor: "9.9.9.9",
        socketAddress: "203.0.113.7",
        trustedProxyHops: 0,
      }),
    ).toBe("203.0.113.7");
  });

  it("takes the address the trusted proxy saw, not the hops a client prepended", () => {
    expect(
      resolveVisitorIp({
        forwardedFor: "9.9.9.9, 203.0.113.7",
        socketAddress: "10.0.0.1",
        trustedProxyHops: 1,
      }),
    ).toBe("203.0.113.7");
  });

  it("walks back one hop per trusted proxy", () => {
    expect(
      resolveVisitorIp({
        forwardedFor: "9.9.9.9, 203.0.113.7, 10.0.0.2",
        socketAddress: "10.0.0.1",
        trustedProxyHops: 2,
      }),
    ).toBe("203.0.113.7");
  });

  it("stops at the furthest hop when the chain is shorter than the trusted proxies", () => {
    expect(
      resolveVisitorIp({
        forwardedFor: "203.0.113.7",
        socketAddress: "10.0.0.1",
        trustedProxyHops: 3,
      }),
    ).toBe("203.0.113.7");
  });

  it("knows nothing without a socket address", () => {
    expect(
      resolveVisitorIp({ forwardedFor: "9.9.9.9", trustedProxyHops: 1 }),
    ).toBeUndefined();
  });
});
