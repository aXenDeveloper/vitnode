import { describe, expect, it } from "vitest";

import {
  createSsoLinkToken,
  SSO_LINK_TOKEN_TTL_MS,
  verifySsoLinkToken,
} from "./sso-link-token";

const SECRET = "test-secret";

const offer = {
  email: "jan@example.com",
  providerAccountId: "fb-123",
  providerEmail: "jan@example.com",
  providerId: "facebook",
  userId: 42,
};

const now = new Date("2026-09-08T12:00:00Z");

describe("an SSO link token", () => {
  it("round-trips the offer it was minted for", () => {
    const { expiresAt, token } = createSsoLinkToken({
      now,
      offer,
      secret: SECRET,
    });

    expect(expiresAt.getTime()).toBe(now.getTime() + SSO_LINK_TOKEN_TTL_MS);
    expect(
      verifySsoLinkToken({
        now,
        providerId: "facebook",
        secret: SECRET,
        token,
      }),
    ).toEqual(offer);
  });

  it("keeps an address confirmed by code apart from the provider's own", () => {
    const { token } = createSsoLinkToken({
      now,
      offer: { ...offer, providerEmail: null },
      secret: SECRET,
    });

    expect(
      verifySsoLinkToken({
        now,
        providerId: "facebook",
        secret: SECRET,
        token,
      }),
    ).toEqual({ ...offer, providerEmail: null });
  });

  it("is only good for the provider that produced it", () => {
    const { token } = createSsoLinkToken({ now, offer, secret: SECRET });

    expect(
      verifySsoLinkToken({ now, providerId: "google", secret: SECRET, token }),
    ).toBeNull();
  });

  it("expires", () => {
    const { expiresAt, token } = createSsoLinkToken({
      now,
      offer,
      secret: SECRET,
    });

    expect(
      verifySsoLinkToken({
        now: new Date(expiresAt.getTime() - 1000),
        providerId: "facebook",
        secret: SECRET,
        token,
      }),
    ).toEqual(offer);
    expect(
      verifySsoLinkToken({
        now: expiresAt,
        providerId: "facebook",
        secret: SECRET,
        token,
      }),
    ).toBeNull();
  });

  it("refuses a token signed with another secret, or tampered with", () => {
    const { token } = createSsoLinkToken({ now, offer, secret: SECRET });
    const [body, signature] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body ?? "", "base64url").toString("utf8")),
        u: 1,
      }),
    ).toString("base64url");

    expect(
      verifySsoLinkToken({
        now,
        providerId: "facebook",
        secret: "other",
        token,
      }),
    ).toBeNull();
    expect(
      verifySsoLinkToken({
        now,
        providerId: "facebook",
        secret: SECRET,
        token: `${forgedBody}.${signature}`,
      }),
    ).toBeNull();
    expect(
      verifySsoLinkToken({
        now,
        providerId: "facebook",
        secret: SECRET,
        token: "",
      }),
    ).toBeNull();
  });
});
