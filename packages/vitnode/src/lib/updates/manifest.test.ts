import { describe, expect, it } from "vitest";

import {
  channelOfVersion,
  parseUpdateManifest,
  versionInRange,
} from "./manifest";

const SECURITY_UPDATE = {
  affected: "<1.2.1",
  fixed: "1.2.1",
  id: "VN-2026-001",
  url: "https://example.com/advisories/VN-2026-001",
};

const manifestWith = (entry: Record<string, unknown>) => ({
  packages: { "@acme/blog": entry },
  schemaVersion: 1,
});

describe("parseUpdateManifest", () => {
  it("reads a manifest and fills in what a package leaves out", () => {
    const result = parseUpdateManifest({
      packages: {
        "@acme/blog": {
          securityUpdates: [SECURITY_UPDATE],
          channels: { canary: "1.3.0-canary.2", stable: "1.2.1" },
          releases: {
            "1.2.1": { requiresCore: "^2.0.0" },
            "1.3.0-canary.2": {},
          },
        },
        "@acme/shop": {},
      },
      schemaVersion: 1,
    });

    expect(result).toEqual({
      manifest: {
        packages: {
          "@acme/blog": {
            securityUpdates: [SECURITY_UPDATE],
            channels: { canary: "1.3.0-canary.2", stable: "1.2.1" },
            releases: {
              "1.2.1": { requiresCore: "^2.0.0" },
              "1.3.0-canary.2": {},
            },
          },
          "@acme/shop": { securityUpdates: [], channels: {}, releases: {} },
        },
        schemaVersion: 1,
      },
      ok: true,
    });
  });

  it.each([
    ["a future version", { packages: {}, schemaVersion: 2 }, /schemaVersion 2/],
    ["a missing version", { packages: {} }, /Missing or invalid/],
    ["a string version", { schemaVersion: "1" }, /Missing or invalid/],
    [
      "a future format that looks nothing like this one",
      { schemaVersion: 2, sources: [] },
      /schemaVersion 2/,
    ],
  ])("reports %s as unsupported, not invalid", (_, value, error) => {
    expect(parseUpdateManifest(value)).toEqual({
      error: expect.stringMatching(error),
      ok: false,
      reason: "unsupported_schema",
    });
  });

  it.each([
    ["an array", []],
    ["null", null],
    ["a string", "updates"],
    [
      "a channel pointing to a release that is not listed",
      manifestWith({ channels: { stable: "1.2.1" } }),
    ],
    [
      "a stable channel pointing to a prerelease",
      manifestWith({
        channels: { stable: "1.3.0-rc.1" },
        releases: { "1.3.0-rc.1": {} },
      }),
    ],
    [
      "the same securityUpdate twice",
      manifestWith({ securityUpdates: [SECURITY_UPDATE, SECURITY_UPDATE] }),
    ],
    [
      "a security update linking over http",
      manifestWith({
        securityUpdates: [{ ...SECURITY_UPDATE, url: "http://example.com/a" }],
      }),
    ],
    [
      "a security update with no valid range",
      manifestWith({
        securityUpdates: [{ ...SECURITY_UPDATE, affected: "soon" }],
      }),
    ],
    [
      "a release keyed by a non-SemVer version",
      manifestWith({ releases: { latest: {} } }),
    ],
    [
      "a release with an unknown field",
      manifestWith({ releases: { "1.0.0": { download: "https://x.io" } } }),
    ],
    [
      "a package name that is not an npm name",
      { packages: { "Acme Blog": {} }, schemaVersion: 1 },
    ],
  ])("rejects %s as invalid", (_, value) => {
    expect(parseUpdateManifest(value)).toMatchObject({
      ok: false,
      reason: "invalid",
    });
  });

  it("names the offending channel", () => {
    const result = parseUpdateManifest(
      manifestWith({ channels: { rc: "1.3.0-rc.1" } }),
    );

    expect(result.ok ? null : result.error).toMatch(
      /packages\.@acme\/blog\.channels\.rc: .*1\.3\.0-rc\.1/,
    );
  });
});

describe("channelOfVersion", () => {
  it.each([
    ["2.1.0", "stable"],
    ["2.1.0-rc.1", "rc"],
    ["2.1.0-rc1", "rc"],
    ["2.1.0-canary.4", "canary"],
    ["2.1.0-beta.1", null],
    ["2.1.0-1", null],
    ["not a version", null],
  ])("puts %s on %s", (version, channel) => {
    expect(channelOfVersion(version)).toBe(channel);
  });
});

describe("versionInRange", () => {
  it.each([
    ["2.1.3-canary.1", "<2.1.3", true],
    ["2.1.3-rc.1", ">=2.0.0 <2.1.3", true],
    ["2.1.3", "<2.1.3", false],
    ["2.0.5", ">=2.0.0 <2.1.3", true],
    ["1.9.9", ">=2.0.0 <2.1.3", false],
  ])("%s inside %s is %s", (version, range, inside) => {
    expect(versionInRange(version, range)).toBe(inside);
  });
});
