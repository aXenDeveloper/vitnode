import { gt, lte, rcompare, satisfies, valid } from "semver";

import type {
  AdvisorySeverity,
  UpdateChannel,
  UpdatePackage,
  UpdateRelease,
} from "@/lib/updates/manifest";

import { channelOfVersion, versionInRange } from "@/lib/updates/manifest";

export type UpdateStatus =
  /** The package exists, but publishes nothing on the selected channel. */
  | "channel_missing"
  /** The publisher has no entry for this package. */
  | "package_missing"
  /** The installed version is on no known channel, and no override names one. */
  | "unknown_channel"
  | "up_to_date"
  | "update_available"
  /** No newer release, but a registration reports no valid version, so "up to date" would be a guess. */
  | "version_unknown";

export type UpdateCompatibility = "compatible" | "incompatible" | "unknown";

export interface UpdateReleaseInfo {
  publishedAt: null | string;
  requiresCore: null | string;
  url: null | string;
  version: string;
}

export interface UpdateAdvisoryFinding {
  affected: string;
  fixed: null | string;
  id: string;
  severity: AdvisorySeverity;
  summary: null | string;
  url: string;
  /** The installed versions inside `affected` - the API's, the web app's, or both. */
  versions: string[];
}

export interface UpdateEvaluation {
  advisories: UpdateAdvisoryFinding[];
  /** The newest release on the channel that declares it works with the running core, when `latest` does not. */
  alternative: null | UpdateReleaseInfo;
  channel: null | UpdateChannel;
  /** Of `latest` with the running core. `null` for core itself and when there is no newer release. */
  compatibility: null | UpdateCompatibility;
  latest: null | UpdateReleaseInfo;
  status: UpdateStatus;
}

export interface UpdateComponentVersions {
  /** A registration reported no version, or one that is not SemVer. */
  hasUnknownVersion: boolean;
  /** Distinct valid versions, newest first. */
  versions: string[];
}

/** Valid, distinct, newest first; anything else only flips `hasUnknownVersion`. */
export const normalizeInstalledVersions = (
  reported: readonly (null | string)[],
): UpdateComponentVersions => {
  const versions = new Set<string>();
  let hasUnknownVersion = reported.length === 0;

  for (const value of reported) {
    const normalized = value === null ? null : valid(value);
    if (normalized === null) {
      hasUnknownVersion = true;
    } else {
      versions.add(normalized);
    }
  }

  return { hasUnknownVersion, versions: [...versions].sort(rcompare) };
};

const releaseInfo = (
  version: string,
  release: undefined | UpdateRelease,
): UpdateReleaseInfo => ({
  publishedAt: release?.publishedAt ?? null,
  requiresCore: release?.requiresCore ?? null,
  url: release?.url ?? null,
  version,
});

const compatibilityOf = (
  release: UpdateReleaseInfo,
  coreVersion: null | string,
): UpdateCompatibility => {
  if (release.requiresCore === null || coreVersion === null) return "unknown";

  return satisfies(coreVersion, release.requiresCore, {
    includePrerelease: true,
  })
    ? "compatible"
    : "incompatible";
};

/**
 * Only from releases the publisher listed, on the same channel, newer than what
 * runs, no newer than the channel target, and explicitly declaring a
 * `requiresCore` the running core satisfies. A release that says nothing about
 * core is not offered as "compatible".
 */
const compatibleAlternative = (
  entry: UpdatePackage,
  channel: UpdateChannel,
  newestInstalled: string,
  target: string,
  coreVersion: null | string,
): null | UpdateReleaseInfo => {
  if (coreVersion === null) return null;

  const candidates = Object.keys(entry.releases)
    .filter(
      version =>
        channelOfVersion(version) === channel &&
        gt(version, newestInstalled) &&
        lte(version, target),
    )
    .sort(rcompare);

  for (const version of candidates) {
    const info = releaseInfo(version, entry.releases[version]);
    if (compatibilityOf(info, coreVersion) === "compatible") return info;
  }

  return null;
};

const advisoryFindings = (
  entry: undefined | UpdatePackage,
  versions: readonly string[],
): UpdateAdvisoryFinding[] =>
  (entry?.advisories ?? []).flatMap(advisory => {
    const affected = versions.filter(version =>
      versionInRange(version, advisory.affected),
    );
    if (affected.length === 0) return [];

    return [
      {
        affected: advisory.affected,
        fixed: advisory.fixed ?? null,
        id: advisory.id,
        severity: advisory.severity,
        summary: advisory.summary ?? null,
        url: advisory.url,
        versions: affected,
      },
    ];
  });

export const evaluateUpdate = ({
  channelOverride,
  coreVersion,
  entry,
  installed,
  isCore,
}: {
  channelOverride: null | UpdateChannel;
  /** The running core version, for `requiresCore`. */
  coreVersion: null | string;
  /** This package's entry in its publisher's manifest; `undefined` when absent. */
  entry: undefined | UpdatePackage;
  installed: UpdateComponentVersions;
  isCore: boolean;
}): UpdateEvaluation => {
  const [newest] = [...installed.versions].sort(rcompare);
  const channel =
    channelOverride ?? (newest === undefined ? null : channelOfVersion(newest));
  // Advisories never depend on channels or releases: a vulnerable build is
  // reported even when its publisher stopped shipping that channel.
  const advisories = advisoryFindings(entry, installed.versions);
  const base = {
    advisories,
    alternative: null,
    channel,
    compatibility: null,
    latest: null,
  };

  if (entry === undefined) return { ...base, status: "package_missing" };
  if (newest === undefined) return { ...base, status: "version_unknown" };
  if (channel === null) return { ...base, status: "unknown_channel" };

  const target = entry.channels[channel];
  if (target === undefined) return { ...base, status: "channel_missing" };

  const latest = releaseInfo(target, entry.releases[target]);
  const outdated = installed.versions.some(version => gt(target, version));

  if (!outdated) {
    return {
      ...base,
      latest,
      status: installed.hasUnknownVersion ? "version_unknown" : "up_to_date",
    };
  }

  const compatibility = isCore ? null : compatibilityOf(latest, coreVersion);

  return {
    ...base,
    alternative:
      compatibility === "incompatible"
        ? compatibleAlternative(entry, channel, newest, target, coreVersion)
        : null,
    compatibility,
    latest,
    status: "update_available",
  };
};
