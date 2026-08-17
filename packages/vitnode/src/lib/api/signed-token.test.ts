// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { signPayload, verifySignedPayload } from "./signed-token";

const SECRET = "test-secret";

const schema = z.object({ id: z.number(), scope: z.string() });

describe("signPayload", () => {
  it("round-trips a payload", () => {
    const token = signPayload(SECRET, { id: 7, scope: "preview" });

    expect(verifySignedPayload(SECRET, token, schema)).toEqual({
      id: 7,
      scope: "preview",
    });
  });

  it("produces a URL-safe token", () => {
    const token = signPayload(SECRET, {
      id: 1,
      scope: "a value with spaces & symbols?=/+",
    });

    // Anything outside this set would need escaping in a path segment, which
    // means a link pasted into an email would arrive broken.
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("is deterministic, so the same state yields the same link", () => {
    const payload = { id: 7, scope: "preview" };

    expect(signPayload(SECRET, payload)).toBe(signPayload(SECRET, payload));
  });
});

describe("verifySignedPayload", () => {
  it("rejects a different secret", () => {
    const token = signPayload(SECRET, { id: 7, scope: "preview" });

    expect(verifySignedPayload("another-secret", token, schema)).toBeNull();
  });

  it("rejects a flipped signature byte", () => {
    const token = signPayload(SECRET, { id: 7, scope: "preview" });
    const [body, signature] = token.split(".");
    const flipped = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;

    expect(
      verifySignedPayload(SECRET, `${body}.${flipped}`, schema),
    ).toBeNull();
  });

  it("rejects an edited payload", () => {
    // The whole point: the payload is readable, so it must not be trusted.
    const forged = Buffer.from(
      JSON.stringify({ id: 9999, scope: "preview" }),
      "utf8",
    ).toString("base64url");
    const signature = signPayload(SECRET, { id: 7, scope: "preview" }).split(
      ".",
    )[1];

    expect(
      verifySignedPayload(SECRET, `${forged}.${signature}`, schema),
    ).toBeNull();
  });

  it("rejects a payload of the wrong shape", () => {
    const token = signPayload(SECRET, { nope: true });

    expect(verifySignedPayload(SECRET, token, schema)).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["no separator", "abcdef"],
    ["two separators", "a.b.c"],
    ["empty body", ".signature"],
    ["empty signature", "body."],
    ["not base64url", "!!!.???"],
    ["not JSON", `${Buffer.from("nope", "utf8").toString("base64url")}.x`],
  ])("returns null rather than throwing for %s input", (_name, token) => {
    // A token arrives from a URL, so malformed input is ordinary rather than
    // exceptional - a caller that has to wrap every call in `try` forgets to.
    expect(() => verifySignedPayload(SECRET, token, schema)).not.toThrow();
    expect(verifySignedPayload(SECRET, token, schema)).toBeNull();
  });

  it("rejects a signature of the wrong length without throwing", () => {
    // `timingSafeEqual` throws on mismatched lengths, so the guard has to come
    // first. This is the test that proves it does.
    const [body] = signPayload(SECRET, { id: 7, scope: "preview" }).split(".");

    expect(verifySignedPayload(SECRET, `${body}.short`, schema)).toBeNull();
  });
});
