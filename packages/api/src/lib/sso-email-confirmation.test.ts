import { describe, expect, it } from "vitest";

import { ssoConfirmsEmail } from "./sso-email-confirmation";

describe("whether an SSO sign-in confirms the account's email", () => {
  it("confirms an unverified address the provider just vouched for", () => {
    expect(
      ssoConfirmsEmail({
        accountEmail: "jan@example.com",
        emailVerified: false,
        providerEmail: "jan@example.com",
      }),
    ).toBe(true);
  });

  it("matches the address the way sign-in does, canonical form included", () => {
    expect(
      ssoConfirmsEmail({
        accountEmail: "jankowalski@gmail.com",
        emailVerified: false,
        providerEmail: "Jan.Kowalski@gmail.com",
      }),
    ).toBe(true);
  });

  it("leaves a verified account alone", () => {
    expect(
      ssoConfirmsEmail({
        accountEmail: "jan@example.com",
        emailVerified: true,
        providerEmail: "jan@example.com",
      }),
    ).toBe(false);
  });

  it("does not confirm an address the provider did not return", () => {
    expect(
      ssoConfirmsEmail({
        accountEmail: "old@example.com",
        emailVerified: false,
        providerEmail: "new@example.com",
      }),
    ).toBe(false);
  });
});
