import { describe, expect, it } from "vitest";

import {
  plainNotificationText,
  safeNotificationTarget,
  sanitizeDeliveryError,
} from "./safe";

describe("safeNotificationTarget", () => {
  it.each([
    ["/blog/hello", "/blog/hello"],
    ["/search?q=a#top", "/search?q=a#top"],
    ["/a/../b", "/b"],
  ])("keeps the on-site path %s", (input, expected) => {
    expect(safeNotificationTarget(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/x",
    "//evil.example/x",
    "/\\evil.example",
    "javascript:alert(1)",
    "blog/hello",
    "/x\u0000y",
    "",
    42,
    null,
  ])("drops %s", input => {
    expect(safeNotificationTarget(input)).toBeNull();
  });
});

describe("plainNotificationText", () => {
  it("collapses whitespace, strips control characters and bounds the length", () => {
    expect(plainNotificationText("  a\n\n b\u0007 ")).toBe("a b");
    expect(plainNotificationText("x".repeat(600))).toHaveLength(500);
    expect(plainNotificationText(undefined)).toBe("");
  });
});

describe("sanitizeDeliveryError", () => {
  it("redacts addresses and credentials", () => {
    expect(
      sanitizeDeliveryError(
        new Error(
          "550 bob@example.com rejected, api_key=sk_live_1 Bearer abc.def",
        ),
      ),
    ).toBe("550 [email] rejected, api_key=[redacted] Bearer [redacted]");
  });
});
