import { describe, expect, it } from "vitest";

import {
  buildForwardedHeaders,
  CAPTCHA_TOKEN_HEADER,
  FORWARDED_IP_FALLBACK,
  FORWARDED_USER_AGENT_FALLBACK,
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
