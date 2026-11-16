import { describe, expect, it } from "vitest";

import { canonicalizeEmail, normalizeEmailAddress } from "./email-canonical";

describe("normalizeEmailAddress", () => {
  it("trims and lowercases without touching the local part shape", () => {
    expect(normalizeEmailAddress("  Jan.Kowalski+Tag@Example.COM ")).toBe(
      "jan.kowalski+tag@example.com",
    );
  });
});

describe("canonicalizeEmail", () => {
  it("collapses the Gmail dot variants onto one address", () => {
    expect(canonicalizeEmail("jankowalski@gmail.com")).toBe(
      "jankowalski@gmail.com",
    );
    expect(canonicalizeEmail("jan.kowalski@gmail.com")).toBe(
      "jankowalski@gmail.com",
    );
    expect(canonicalizeEmail("j.a.n.k.o.w.a.l.s.k.i@gmail.com")).toBe(
      "jankowalski@gmail.com",
    );
  });

  it("treats googlemail.com as gmail.com", () => {
    expect(canonicalizeEmail("jankowalski@googlemail.com")).toBe(
      "jankowalski@gmail.com",
    );
    expect(canonicalizeEmail("jan.kowalski@GoogleMail.com")).toBe(
      "jankowalski@gmail.com",
    );
  });

  it("drops the plus alias on Gmail", () => {
    expect(canonicalizeEmail("jankowalski+mikrus@gmail.com")).toBe(
      "jankowalski@gmail.com",
    );
    expect(canonicalizeEmail("jan.kowalski+spam@googlemail.com")).toBe(
      "jankowalski@gmail.com",
    );
  });

  it("drops the plus alias on other providers that support it", () => {
    expect(canonicalizeEmail("jan+shop@outlook.com")).toBe("jan@outlook.com");
    expect(canonicalizeEmail("jan+shop@hotmail.co.uk")).toBe(
      "jan@hotmail.co.uk",
    );
    expect(canonicalizeEmail("jan+shop@live.de")).toBe("jan@live.de");
    expect(canonicalizeEmail("jan+shop@icloud.com")).toBe("jan@icloud.com");
    expect(canonicalizeEmail("jan+shop@proton.me")).toBe("jan@proton.me");
  });

  it("keeps dots outside Gmail, because they are part of the mailbox there", () => {
    expect(canonicalizeEmail("jan.kowalski@outlook.com")).toBe(
      "jan.kowalski@outlook.com",
    );
    expect(canonicalizeEmail("jan.kowalski@company.com")).toBe(
      "jan.kowalski@company.com",
    );
  });

  it("leaves unknown domains alone apart from case", () => {
    expect(canonicalizeEmail("Jan.Kowalski+Tag@Company.COM")).toBe(
      "jan.kowalski+tag@company.com",
    );
  });

  it("does not fold a Microsoft-looking corporate subdomain", () => {
    expect(canonicalizeEmail("jan+tag@live.corp.example.com")).toBe(
      "jan+tag@live.corp.example.com",
    );
  });

  it("keeps a hyphen, so Yahoo-style local parts are never merged", () => {
    expect(canonicalizeEmail("jan-kowalski@yahoo.com")).toBe(
      "jan-kowalski@yahoo.com",
    );
  });

  it("falls back to the normalized address for input it cannot split", () => {
    expect(canonicalizeEmail("not-an-email")).toBe("not-an-email");
    expect(canonicalizeEmail("@gmail.com")).toBe("@gmail.com");
    expect(canonicalizeEmail("jan@")).toBe("jan@");
    expect(canonicalizeEmail("+tag@gmail.com")).toBe("+tag@gmail.com");
    expect(canonicalizeEmail("...@gmail.com")).toBe("...@gmail.com");
  });

  it("is idempotent", () => {
    const once = canonicalizeEmail("Jan.Kowalski+ref@GoogleMail.com");

    expect(canonicalizeEmail(once)).toBe(once);
  });
});
