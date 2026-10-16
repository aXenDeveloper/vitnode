import { describe, expect, it } from "vitest";

import type { UpdateManifest } from "../../src/lib/updates/manifest";

import {
  applySecurityUpdates,
  emptyUpdateManifest,
  mergeRelease,
  parseSecurityUpdatesInput,
  readPublishedManifest,
  requiresCoreFrom,
  serializeUpdateManifest,
} from "./merge";

const RELEASE = {
  publishedAt: "2026-10-15T10:00:00Z",
  url: "https://github.com/acme/vitnode/releases/tag/v2.1.0",
};

const SECURITY_UPDATE = {
  affected: "<2.1.0",
  fixed: "2.1.0",
  id: "VN-2026-001",
  url: "https://github.com/acme/vitnode/security/advisories/1",
};

const stable = (
  manifest: UpdateManifest,
  packages: { id: string; requiresCore?: string; version: string }[],
  githubRelease: null | typeof RELEASE = RELEASE,
) => mergeRelease(manifest, { channel: "stable", githubRelease, packages });

describe("mergeRelease", () => {
  it("adds the published packages, with the GitHub Release metadata", () => {
    expect(
      stable(emptyUpdateManifest(), [
        { id: "@vitnode/core", version: "2.1.0" },
        { id: "@vitnode/blog", requiresCore: "^2.1.0", version: "2.1.0" },
      ]).packages,
    ).toEqual({
      "@vitnode/blog": {
        securityUpdates: [],
        channels: { stable: "2.1.0" },
        releases: { "2.1.0": { ...RELEASE, requiresCore: "^2.1.0" } },
      },
      "@vitnode/core": {
        securityUpdates: [],
        channels: { stable: "2.1.0" },
        releases: { "2.1.0": RELEASE },
      },
    });
  });

  it("leaves publishedAt and url out without a GitHub Release", () => {
    expect(
      stable(
        emptyUpdateManifest(),
        [{ id: "@vitnode/core", version: "2.1.0" }],
        null,
      ).packages["@vitnode/core"]?.releases,
    ).toEqual({ "2.1.0": {} });
  });

  it("writes the same bytes when a run is repeated", () => {
    const once = stable(emptyUpdateManifest(), [
      { id: "@vitnode/core", version: "2.1.0" },
    ]);

    expect(
      serializeUpdateManifest(
        stable(once, [{ id: "@vitnode/core", version: "2.1.0" }], {
          publishedAt: "2026-10-16T08:00:00Z",
          url: "https://github.com/acme/vitnode/releases/tag/rerun",
        }),
      ),
    ).toBe(serializeUpdateManifest(once));
  });

  it("fills in what a rerun after the GitHub Release learned", () => {
    const withoutRelease = stable(
      emptyUpdateManifest(),
      [{ id: "@vitnode/core", version: "2.1.0" }],
      null,
    );

    expect(
      stable(withoutRelease, [{ id: "@vitnode/core", version: "2.1.0" }])
        .packages["@vitnode/core"]?.releases["2.1.0"],
    ).toEqual(RELEASE);
  });

  it("never moves a channel backwards when an older release is rerun", () => {
    const newer = stable(emptyUpdateManifest(), [
      { id: "@vitnode/core", version: "2.1.0" },
    ]);

    const merged = stable(newer, [{ id: "@vitnode/core", version: "2.0.5" }]);

    expect(merged.packages["@vitnode/core"]).toMatchObject({
      channels: { stable: "2.1.0" },
      releases: { "2.0.5": {}, "2.1.0": {} },
    });
  });

  it("leaves other packages, channels and securityUpdates untouched", () => {
    const before: UpdateManifest = {
      packages: {
        "@acme/other": {
          securityUpdates: [],
          channels: { stable: "1.0.0" },
          releases: { "1.0.0": {} },
        },
        "@vitnode/core": {
          securityUpdates: [SECURITY_UPDATE],
          channels: { canary: "2.1.0-canary.1", stable: "2.0.0" },
          releases: { "2.0.0": {}, "2.1.0-canary.1": {} },
        },
      },
      schemaVersion: 1,
    };

    const merged = mergeRelease(before, {
      channel: "canary",
      githubRelease: null,
      packages: [{ id: "@vitnode/core", version: "2.1.0-canary.2" }],
    });

    expect(merged.packages["@acme/other"]).toEqual(
      before.packages["@acme/other"],
    );
    expect(merged.packages["@vitnode/core"]).toMatchObject({
      securityUpdates: [SECURITY_UPDATE],
      channels: { canary: "2.1.0-canary.2", stable: "2.0.0" },
    });
  });

  it.each([
    [
      "a prerelease on the stable channel",
      "stable",
      "2.1.0-rc.1",
      /does not belong on the stable channel/,
    ],
    [
      "a stable version on the canary channel",
      "canary",
      "2.1.0",
      /does not belong on the canary channel/,
    ],
    ["a version that is not SemVer", "stable", "v2.1", /not SemVer/],
  ] as const)("rejects %s", (_, channel, version, error) => {
    expect(() =>
      mergeRelease(emptyUpdateManifest(), {
        channel,
        githubRelease: null,
        packages: [{ id: "@vitnode/core", version }],
      }),
    ).toThrow(error);
  });
});

describe("readPublishedManifest", () => {
  it.each([null, "", "  \n"])("starts a new manifest from %j", text => {
    expect(readPublishedManifest(text)).toEqual(emptyUpdateManifest());
  });

  it.each([
    ["text that is not JSON", "{", /not JSON/],
    ["an invalid manifest", '{"schemaVersion":1,"packages":[]}', /invalid/],
  ])("refuses to overwrite %s", (_, text, error) => {
    expect(() => readPublishedManifest(text)).toThrow(error);
  });
});

describe("applySecurityUpdates", () => {
  it("gives each package exactly the securityUpdates the file lists, and keeps releases", () => {
    const published = stable(emptyUpdateManifest(), [
      { id: "@vitnode/blog", version: "2.1.0" },
      { id: "@vitnode/core", version: "2.1.0" },
    ]);
    const withOld = applySecurityUpdates(published, {
      securityUpdates: { "@vitnode/blog": [SECURITY_UPDATE] },
      schemaVersion: 1,
    });

    const next = applySecurityUpdates(withOld, {
      securityUpdates: { "@vitnode/core": [SECURITY_UPDATE] },
      schemaVersion: 1,
    });

    expect(next.packages["@vitnode/blog"]).toMatchObject({
      securityUpdates: [],
      channels: { stable: "2.1.0" },
    });
    expect(next.packages["@vitnode/core"]?.securityUpdates).toEqual([
      SECURITY_UPDATE,
    ]);
  });
});

describe("parseSecurityUpdatesInput", () => {
  it("reads the maintained security updates file", () => {
    expect(
      parseSecurityUpdatesInput(
        JSON.stringify({
          securityUpdates: { "@vitnode/core": [SECURITY_UPDATE] },
          schemaVersion: 1,
        }),
      ),
    ).toEqual({
      securityUpdates: { "@vitnode/core": [SECURITY_UPDATE] },
      schemaVersion: 1,
    });
  });

  it.each([
    ["text that is not JSON", "[", /not JSON/],
    [
      "a security update linking over http",
      JSON.stringify({
        securityUpdates: {
          "@vitnode/core": [{ ...SECURITY_UPDATE, url: "http://x.io" }],
        },
        schemaVersion: 1,
      }),
      /invalid: securityUpdates\.@vitnode\/core\.0\.url/,
    ],
  ])("rejects %s", (_, text, error) => {
    expect(() => parseSecurityUpdatesInput(text)).toThrow(error);
  });
});

describe("requiresCoreFrom", () => {
  it.each([
    [undefined, undefined],
    ["workspace:*", "2.1.0"],
    ["workspace:", "2.1.0"],
    ["workspace:^", "^2.1.0"],
    ["workspace:~", "~2.1.0"],
    ["workspace:^2.0.0", "^2.0.0"],
    [">=2.0.0", ">=2.0.0"],
  ])("turns %s into %s", (spec, expected) => {
    expect(requiresCoreFrom(spec, "2.1.0")).toBe(expected);
  });
});

describe("serializeUpdateManifest", () => {
  it("writes the same bytes whatever order the keys were added in", () => {
    const a = stable(emptyUpdateManifest(), [
      { id: "@vitnode/blog", version: "2.1.0" },
      { id: "@vitnode/core", version: "2.1.0" },
    ]);
    const b = stable(emptyUpdateManifest(), [
      { id: "@vitnode/core", version: "2.1.0" },
      { id: "@vitnode/blog", version: "2.1.0" },
    ]);

    expect(serializeUpdateManifest(a)).toBe(serializeUpdateManifest(b));
    expect(readPublishedManifest(serializeUpdateManifest(a))).toEqual(a);
  });
});
