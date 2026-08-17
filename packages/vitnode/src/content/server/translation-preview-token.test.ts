// @vitest-environment node
import { describe, expect, it } from "vitest";

import { testArticleContentType } from "@/tests/content-fixtures";

import {
  createContentPreviewToken,
  verifyContentPreviewToken,
} from "./preview-token";

const SECRET = "a".repeat(64);
const PLUGIN_ID = "@vitnode/example";

const mint = (overrides: Record<string, unknown> = {}) =>
  createContentPreviewToken({
    definition: testArticleContentType,
    itemId: 7,
    pluginId: PLUGIN_ID,
    revisionId: 11,
    secret: SECRET,
    version: 3,
    ...overrides,
  });

const verify = (token: string, overrides: Record<string, unknown> = {}) =>
  verifyContentPreviewToken({
    definition: testArticleContentType,
    pluginId: PLUGIN_ID,
    secret: SECRET,
    token,
    ...overrides,
  });

describe("locale binding", () => {
  it("round-trips both frozen revisions", () => {
    const { token } = mint({
      languageId: 2,
      locale: "pl",
      translationRevisionId: 55,
    });

    const payload = verify(token, { locale: "pl" });

    // Both halves, which is what makes the frozen guarantee whole: the shared
    // revision *and* the translation revision. Naming only one would let the other
    // drift under a reviewer who was told the page was frozen.
    expect(payload).toMatchObject({ l: "pl", lid: 2, r: 11, tr: 55 });
  });

  it("refuses a token minted for another locale", () => {
    const { token } = mint({
      languageId: 2,
      locale: "pl",
      translationRevisionId: 55,
    });

    expect(verify(token, { locale: "en" })).toBeNull();
  });

  it("refuses a locale-scoped read with a base token", () => {
    // A token with no locale previews the shared row. Honouring it on a locale
    // read would be a fallback, and a preview must never fall back.
    expect(verify(mint().token, { locale: "pl" })).toBeNull();
  });

  it("refuses a locale token on a base read", () => {
    const { token } = mint({ languageId: 2, locale: "pl" });

    expect(verify(token)).toBeNull();
  });

  it("matches the locale case-insensitively", () => {
    const { token } = mint({ languageId: 2, locale: "pl" });

    // A locale travels in a URL, and `/PL/` naming the same language is what
    // people expect - the same rule the language resolver follows.
    expect(verify(token, { locale: "PL" })).not.toBeNull();
  });

  it("carries no locale keys at all on a base token", () => {
    const payload = verify(mint().token);

    // Byte-identical to what Stage 4 minted, so an existing link keeps working and
    // keeps meaning what it meant.
    expect(payload).not.toHaveProperty("l");
    expect(payload).not.toHaveProperty("tr");
  });

  it("defaults the translation revision to 0 when there is none to freeze", () => {
    const { token } = mint({ languageId: 2, locale: "pl" });

    expect(verify(token, { locale: "pl" })?.tr).toBe(0);
  });
});

describe("tampering", () => {
  it("rejects a token whose locale was edited", () => {
    const { token } = mint({ languageId: 2, locale: "pl" });
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        ...(JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<
          string,
          unknown
        >),
        l: "en",
      }),
    ).toString("base64url");

    expect(verify(`${forged}.${signature}`, { locale: "en" })).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const { token } = createContentPreviewToken({
      definition: testArticleContentType,
      itemId: 7,
      languageId: 2,
      locale: "pl",
      pluginId: PLUGIN_ID,
      revisionId: 11,
      secret: "b".repeat(64),
      version: 3,
    });

    expect(verify(token, { locale: "pl" })).toBeNull();
  });

  it("rejects an expired locale token", () => {
    const { token } = mint({
      languageId: 2,
      locale: "pl",
      now: new Date("2020-01-01T00:00:00Z"),
    });

    expect(verify(token, { locale: "pl" })).toBeNull();
  });

  it("rejects a locale token minted for another content type", () => {
    const { token } = mint({ languageId: 2, locale: "pl" });

    expect(
      verifyContentPreviewToken({
        definition: { ...testArticleContentType, id: "test.other" },
        locale: "pl",
        pluginId: PLUGIN_ID,
        secret: SECRET,
        token,
      }),
    ).toBeNull();
  });
});
