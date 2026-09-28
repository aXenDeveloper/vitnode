import { describe, expect, it } from "vitest";

import { passkeyConfigProblems, resolvePasskeysConfig } from "./passkey-config";

describe("resolvePasskeysConfig", () => {
  it("is off when the config has no passkeys block", () => {
    expect(
      resolvePasskeysConfig({
        config: undefined,
        rpNameFallback: "VitNode",
        webOrigin: "https://example.com",
      }),
    ).toEqual({ enabled: false, problems: [] });
  });

  it("is off when set to false", () => {
    expect(
      resolvePasskeysConfig({
        config: false,
        rpNameFallback: "VitNode",
        webOrigin: "https://example.com",
      }),
    ).toEqual({ enabled: false, problems: [] });
  });

  it.each([true, {}])(
    "derives the RP ID and origin from the web origin for %j",
    config => {
      expect(
        resolvePasskeysConfig({
          config,
          rpNameFallback: "VitNode",
          webOrigin: "http://localhost:3000",
        }),
      ).toEqual({
        enabled: true,
        origins: ["http://localhost:3000"],
        rpId: "localhost",
        rpName: "VitNode",
      });
    },
  );

  it("fails fast when true meets a web origin that cannot host passkeys", () => {
    expect(() =>
      resolvePasskeysConfig({
        config: true,
        rpNameFallback: "VitNode",
        webOrigin: "http://192.168.1.10:3000",
      }),
    ).toThrow(/IP address/);
  });

  it("accepts a parent-domain RP ID shared by several origins", () => {
    expect(
      resolvePasskeysConfig({
        config: {
          origins: ["https://example.com", "https://forum.example.com"],
          rpId: "example.com",
          rpName: "Example",
        },
        rpNameFallback: "VitNode",
        webOrigin: "https://example.com",
      }),
    ).toMatchObject({ enabled: true, rpId: "example.com", rpName: "Example" });
  });

  it("fails fast when the web origin cannot host passkeys", () => {
    expect(() =>
      resolvePasskeysConfig({
        config: {},
        rpNameFallback: "VitNode",
        webOrigin: "http://192.168.1.10:3000",
      }),
    ).toThrow(/plain HTTP/);
  });

  it("fails fast on an RP ID that does not cover the origins", () => {
    expect(() =>
      resolvePasskeysConfig({
        config: { origins: ["https://example.com"], rpId: "other.com" },
        rpNameFallback: "VitNode",
        webOrigin: "https://example.com",
      }),
    ).toThrow(/other\.com/);
  });
});

describe("passkeyConfigProblems", () => {
  it("allows plain HTTP only on localhost", () => {
    expect(
      passkeyConfigProblems({
        origins: ["http://app.localhost:3000"],
        rpId: "localhost",
      }),
    ).toEqual([]);
    expect(
      passkeyConfigProblems({
        origins: ["http://example.com"],
        rpId: "example.com",
      }),
    ).toHaveLength(1);
  });

  it("refuses an IP address as the RP ID", () => {
    expect(
      passkeyConfigProblems({
        origins: ["https://127.0.0.1"],
        rpId: "127.0.0.1",
      }),
    ).not.toEqual([]);
  });

  it("refuses an origin with a path and a look-alike domain", () => {
    expect(
      passkeyConfigProblems({
        origins: ["https://example.com/", "https://notexample.com"],
        rpId: "example.com",
      }),
    ).toHaveLength(2);
  });
});
