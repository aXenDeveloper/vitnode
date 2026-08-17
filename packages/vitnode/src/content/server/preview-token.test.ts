// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testEditorialNoteContentType,
  testEditorialPostContentType,
} from "../../tests/content-fixtures";
import {
  createContentPreviewToken,
  verifyContentPreviewToken,
} from "./preview-token";

// Long enough to be a real signing key: the preview routes fail closed on a
// secret that is missing, well-known or under 32 bytes, so a short one here
// would test the guard rather than the route.
const SECRET = "unit-test-content-preview-secret-0123456789";
const PLUGIN = "@vitnode/test";

const NOW = new Date("2026-08-05T10:00:00.000Z");

const mint = (overrides?: {
  definition?: typeof testEditorialPostContentType;
  itemId?: number;
  now?: Date;
  pluginId?: string;
  revisionId?: number;
  secret?: string;
}) =>
  createContentPreviewToken({
    definition: overrides?.definition ?? testEditorialPostContentType,
    itemId: overrides?.itemId ?? 7,
    now: overrides?.now ?? NOW,
    pluginId: overrides?.pluginId ?? PLUGIN,
    revisionId: overrides?.revisionId ?? 42,
    secret: overrides?.secret ?? SECRET,
    version: 3,
  });

const verify = (token: string, now = NOW) =>
  verifyContentPreviewToken({
    definition: testEditorialPostContentType,
    now,
    pluginId: PLUGIN,
    secret: SECRET,
    token,
  });

describe("createContentPreviewToken", () => {
  it("expires after the content type's configured window", () => {
    // The fixture asks for 30 minutes rather than the default 15, so this also
    // proves the config is read rather than the constant.
    expect(
      testEditorialPostContentType.editorial.preview.expiresInMinutes,
    ).toBe(30);
    expect(mint().expiresAt.toISOString()).toBe("2026-08-05T10:30:00.000Z");
  });

  it("binds the record and its revision", () => {
    const payload = verify(mint().token);

    expect(payload).toMatchObject({ i: 7, p: PLUGIN, r: 42, ver: 3 });
    expect(payload?.t).toBe(testEditorialPostContentType.id);
  });
});

describe("verifyContentPreviewToken", () => {
  it("accepts a fresh token", () => {
    expect(verify(mint().token)).not.toBeNull();
  });

  it("rejects it once it has expired", () => {
    const { token } = mint();

    expect(verify(token, new Date("2026-08-05T10:29:59.000Z"))).not.toBeNull();
    // No leeway at all: the boundary is the boundary.
    expect(verify(token, new Date("2026-08-05T10:30:00.000Z"))).toBeNull();
    expect(verify(token, new Date("2026-08-05T11:00:00.000Z"))).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    expect(verify(mint({ secret: "other-secret" }).token)).toBeNull();
  });

  it("rejects a token minted for another plugin", () => {
    // The signature is valid - the *scope* is not. Without this check one
    // signed token would work on every preview route in the install.
    expect(verify(mint({ pluginId: "@vitnode/other" }).token)).toBeNull();
  });

  it("rejects a token minted for another content type", () => {
    const { token } = createContentPreviewToken({
      definition: testEditorialNoteContentType,
      itemId: 7,
      now: NOW,
      pluginId: PLUGIN,
      revisionId: 42,
      secret: SECRET,
      version: 3,
    });

    expect(verify(token)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const { token } = mint();
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        aud: "content-preview",
        exp: Math.floor(NOW.getTime() / 1000) + 3600,
        i: 999,
        p: PLUGIN,
        r: 1,
        t: testEditorialPostContentType.id,
        v: 1,
        ver: 1,
      }),
      "utf8",
    ).toString("base64url");

    expect(verify(`${forged}.${signature}`)).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["garbage", "not-a-token"],
    ["only a separator", "."],
    ["truncated", "eyJhdWQiOiJjb250ZW50LXByZXZpZXcifQ"],
  ])("rejects %s input without throwing", (_name, token) => {
    expect(() => verify(token)).not.toThrow();
    expect(verify(token)).toBeNull();
  });

  it("keeps every failure indistinguishable", () => {
    // The route answers 404 for all of them, so the function must not hand it
    // anything it could accidentally branch on. One value, every time.
    const failures = [
      verify(""),
      verify("garbage"),
      verify(mint({ secret: "other" }).token),
      verify(mint({ pluginId: "@vitnode/other" }).token),
      verify(mint().token, new Date("2026-08-06T00:00:00.000Z")),
    ];

    expect(failures).toEqual([null, null, null, null, null]);
  });
});
