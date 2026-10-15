import { describe, expect, it } from "vitest";

import type { UpdateChannel, UpdatePackage } from "@/lib/updates/manifest";

import { evaluateUpdate, normalizeInstalledVersions } from "./evaluate";

const ENTRY: UpdatePackage = {
  advisories: [],
  channels: { canary: "2.2.0-canary.3", rc: "2.2.0-rc.1", stable: "2.1.0" },
  releases: {
    "2.0.1": { requiresCore: "^1.0.0" },
    "2.0.2": { requiresCore: "^1.0.0 || ^2.0.0" },
    "2.0.3": {},
    "2.1.0": {
      publishedAt: "2026-10-01T10:00:00Z",
      requiresCore: "^3.0.0",
      url: "https://example.com/releases/2.1.0",
    },
    "2.2.0-canary.3": {},
    "2.2.0-rc.1": {},
  },
};

const ADVISORY = {
  affected: "<2.0.3",
  fixed: "2.0.3",
  id: "VN-2026-001",
  severity: "critical" as const,
  url: "https://example.com/advisories/VN-2026-001",
};

const evaluate = (
  reported: (null | string)[],
  options: {
    channelOverride?: null | UpdateChannel;
    coreVersion?: null | string;
    entry?: undefined | UpdatePackage;
    isCore?: boolean;
  } = {},
) =>
  evaluateUpdate({
    channelOverride: options.channelOverride ?? null,
    coreVersion:
      "coreVersion" in options ? (options.coreVersion ?? null) : "2.5.0",
    entry: "entry" in options ? options.entry : ENTRY,
    installed: normalizeInstalledVersions(reported),
    isCore: options.isCore ?? false,
  });

describe("normalizeInstalledVersions", () => {
  it("keeps distinct valid versions, newest first", () => {
    expect(
      normalizeInstalledVersions(["1.0.0", "v1.2.0", "1.0.0", "1.10.0"]),
    ).toEqual({
      hasUnknownVersion: false,
      versions: ["1.10.0", "1.2.0", "1.0.0"],
    });
  });

  it.each([
    ["no registration", []],
    ["a registration without a version", ["1.0.0", null]],
    ["a version that is not SemVer", ["1.0.0", "latest"]],
  ])("flags %s as an unknown version", (_, reported) => {
    expect(normalizeInstalledVersions(reported).hasUnknownVersion).toBe(true);
  });
});

describe("evaluateUpdate", () => {
  it.each([
    ["stable", "2.0.0", "2.1.0"],
    ["rc", "2.2.0-rc.0", "2.2.0-rc.1"],
    ["canary", "2.2.0-canary.1", "2.2.0-canary.3"],
  ])(
    "follows the %s channel of the installed version",
    (channel, installed, target) => {
      expect(evaluate([installed])).toMatchObject({
        channel,
        latest: { version: target },
        status: "update_available",
      });
    },
  );

  it("follows the configured channel instead of the installed version's", () => {
    expect(evaluate(["2.0.0"], { channelOverride: "canary" })).toMatchObject({
      channel: "canary",
      latest: { version: "2.2.0-canary.3" },
      status: "update_available",
    });
  });

  it("never offers a downgrade when the installed version is newer than the target", () => {
    expect(
      evaluate(["2.2.0-canary.9"], { channelOverride: "stable" }),
    ).toMatchObject({
      latest: { version: "2.1.0" },
      status: "up_to_date",
    });
  });

  it("is up to date on the channel target, with its release details", () => {
    expect(evaluate(["2.1.0"])).toEqual({
      advisories: [],
      alternative: null,
      channel: "stable",
      compatibility: null,
      latest: {
        publishedAt: "2026-10-01T10:00:00Z",
        requiresCore: "^3.0.0",
        url: "https://example.com/releases/2.1.0",
        version: "2.1.0",
      },
      status: "up_to_date",
    });
  });

  it.each([
    [
      "the package is not in the manifest",
      ["2.0.0"],
      undefined,
      "package_missing",
    ],
    [
      "the channel publishes nothing",
      ["2.2.0-rc.0"],
      { ...ENTRY, channels: { stable: "2.1.0" } },
      "channel_missing",
    ],
    [
      "the version is on no known channel",
      ["2.2.0-beta.1"],
      ENTRY,
      "unknown_channel",
    ],
    ["no version is known", [null], ENTRY, "version_unknown"],
    ["one side reports no version", ["2.1.0", null], ENTRY, "version_unknown"],
  ])("when %s, says so", (_, reported, entry, status) => {
    expect(evaluate(reported, { entry }).status).toBe(status);
  });

  it("reports an update when either side runs an older version", () => {
    expect(evaluate(["2.1.0", "2.0.0"]).status).toBe("update_available");
  });

  describe("advisories", () => {
    const withAdvisories = (
      advisories: UpdatePackage["advisories"],
    ): UpdatePackage => ({ ...ENTRY, advisories });

    it("reports a matching advisory with the affected versions", () => {
      expect(
        evaluate(["2.0.1"], { entry: withAdvisories([ADVISORY]) }).advisories,
      ).toEqual([
        {
          affected: "<2.0.3",
          fixed: "2.0.3",
          id: "VN-2026-001",
          severity: "critical",
          summary: null,
          url: "https://example.com/advisories/VN-2026-001",
          versions: ["2.0.1"],
        },
      ]);
    });

    it("reports a vulnerable web app even when the API runs an unaffected version", () => {
      const result = evaluate(["2.1.0", "2.0.1"], {
        entry: withAdvisories([ADVISORY]),
      });

      expect(result.advisories).toMatchObject([{ versions: ["2.0.1"] }]);
    });

    it("reports a vulnerable API even when the web app runs an unaffected version", () => {
      const result = evaluate(["2.0.1", "2.0.3"], {
        entry: withAdvisories([ADVISORY]),
      });

      expect(result.advisories).toMatchObject([{ versions: ["2.0.1"] }]);
    });

    it("matches prereleases inside the affected range", () => {
      expect(
        evaluate(["2.0.3-canary.1"], { entry: withAdvisories([ADVISORY]) })
          .advisories,
      ).toHaveLength(1);
    });

    it("reports an advisory with no fix yet", () => {
      const { fixed: _, ...unfixed } = ADVISORY;

      expect(
        evaluate(["2.1.0"], {
          entry: withAdvisories([{ ...unfixed, affected: "<=2.1.0" }]),
        }),
      ).toMatchObject({
        advisories: [{ fixed: null, versions: ["2.1.0"] }],
        status: "up_to_date",
      });
    });

    it("leaves out an advisory no installed version is affected by", () => {
      expect(
        evaluate(["2.0.3"], { entry: withAdvisories([ADVISORY]) }).advisories,
      ).toEqual([]);
    });

    it("reports advisories whatever the channel says", () => {
      const entry: UpdatePackage = {
        advisories: [{ ...ADVISORY, affected: "<3.0.0" }],
        channels: {},
        releases: {},
      };

      expect(evaluate(["2.2.0-beta.1"], { entry })).toMatchObject({
        advisories: [{ id: "VN-2026-001" }],
        status: "unknown_channel",
      });
    });
  });

  describe("compatibility with the running core", () => {
    const stableAt = (target: string, release: object): UpdatePackage => ({
      advisories: [],
      channels: { stable: target },
      releases: { [target]: release },
    });

    it.each([
      ["compatible", "^2.0.0", "2.5.0"],
      ["incompatible", "^3.0.0", "2.5.0"],
      ["unknown", undefined, "2.5.0"],
      ["unknown", "^2.0.0", null],
    ])(
      "is %s for requiresCore %s on core %s",
      (compatibility, requiresCore, coreVersion) => {
        expect(
          evaluate(["1.0.0"], {
            coreVersion,
            entry: stableAt("1.1.0", requiresCore ? { requiresCore } : {}),
          }),
        ).toMatchObject({ alternative: null, compatibility });
      },
    );

    it("offers the newest older release that declares it works with this core", () => {
      expect(evaluate(["2.0.0"])).toMatchObject({
        alternative: { requiresCore: "^1.0.0 || ^2.0.0", version: "2.0.2" },
        compatibility: "incompatible",
        latest: { version: "2.1.0" },
      });
    });

    it("offers no alternative when no newer release fits this core", () => {
      expect(evaluate(["2.0.2"])).toMatchObject({
        alternative: null,
        compatibility: "incompatible",
      });
    });

    it("does not judge core's own updates against itself", () => {
      expect(evaluate(["2.0.0"], { isCore: true })).toMatchObject({
        alternative: null,
        compatibility: null,
        status: "update_available",
      });
    });
  });
});
