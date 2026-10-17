import { gt } from "semver";
import { z } from "zod";

import type {
  UpdateChannel,
  UpdateManifest,
  UpdatePackage,
  UpdateRelease,
} from "../../src/lib/updates/manifest";

import {
  channelOfVersion,
  isPackageId,
  isStrictVersion,
  parseUpdateManifest,
  securityUpdateSchema,
  UPDATE_MANIFEST_SCHEMA_VERSION,
} from "../../src/lib/updates/manifest";

/**
 * The pure half of publishing VitNode's own update manifest: everything that
 * decides what the JSON says, with no git, GitHub or npm in sight. The release
 * workflow feeds it what it published; the security updates workflow feeds it the
 * maintained security update list.
 */

const ERROR_PREFIX = "[update manifest]";

export const RELEASE_CHANNELS: Record<string, UpdateChannel> = {
  canary: "canary",
  "release-candidate": "rc",
  stable: "stable",
};

export const channelForReleaseType = (releaseType: string): UpdateChannel => {
  const channel = RELEASE_CHANNELS[releaseType];
  if (channel === undefined) {
    throw new Error(
      `${ERROR_PREFIX} Unknown release type ${JSON.stringify(releaseType)}. Expected one of: ${Object.keys(RELEASE_CHANNELS).join(", ")}.`,
    );
  }

  return channel;
};

export const emptyUpdateManifest = (): UpdateManifest => ({
  packages: {},
  schemaVersion: UPDATE_MANIFEST_SCHEMA_VERSION,
});

/** Reads the published file, or starts a new one. Anything invalid stops the run: it is never overwritten blindly. */
export const readPublishedManifest = (text: null | string): UpdateManifest => {
  if (text === null || text.trim() === "") return emptyUpdateManifest();

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${ERROR_PREFIX} The published updates.json is not JSON.`);
  }

  const parsed = parseUpdateManifest(value);
  if (!parsed.ok) {
    throw new Error(
      `${ERROR_PREFIX} The published updates.json is invalid: ${parsed.error}`,
    );
  }

  return parsed.manifest;
};

/** Stable key order, so a rerun that changes nothing writes the same bytes. */
export const serializeUpdateManifest = (manifest: UpdateManifest): string => {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (typeof value !== "object" || value === null) return value;

    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  };

  return `${JSON.stringify(
    {
      schemaVersion: manifest.schemaVersion,
      packages: sortKeys(manifest.packages),
    },
    null,
    2,
  )}\n`;
};

const assertValid = (manifest: UpdateManifest): UpdateManifest => {
  const parsed = parseUpdateManifest(JSON.parse(JSON.stringify(manifest)));
  if (!parsed.ok) {
    throw new Error(
      `${ERROR_PREFIX} The merged manifest is invalid: ${parsed.error}`,
    );
  }

  return parsed.manifest;
};

const emptyPackage = (): UpdatePackage => ({
  securityUpdates: [],
  channels: {},
  releases: {},
});

export interface PublishedPackage {
  id: string;
  /** `requiresCore` for this release, when the package declares one. */
  requiresCore?: string;
  version: string;
}

export interface GitHubReleaseMetadata {
  publishedAt: string;
  url: string;
}

/**
 * Adds one workflow run's packages to the manifest.
 *
 * - Only the run's channel moves, and never backwards: rerunning an older
 *   release leaves a newer channel target alone.
 * - A release entry that already exists keeps its `publishedAt` and `url`. A
 *   rerun after the GitHub Release was created fills in what was missing, and
 *   changes nothing else.
 * - Without a GitHub Release, `publishedAt` and `url` are left out - never
 *   invented.
 * - Other packages, channels, releases and every security update are untouched.
 */
export const mergeRelease = (
  manifest: UpdateManifest,
  {
    channel,
    githubRelease,
    packages,
  }: {
    channel: UpdateChannel;
    githubRelease: GitHubReleaseMetadata | null;
    packages: readonly PublishedPackage[];
  },
): UpdateManifest => {
  const next: UpdateManifest = structuredClone(manifest);

  for (const published of packages) {
    if (!isPackageId(published.id)) {
      throw new Error(
        `${ERROR_PREFIX} ${JSON.stringify(published.id)} is not a package name.`,
      );
    }
    if (!isStrictVersion(published.version)) {
      throw new Error(
        `${ERROR_PREFIX} ${published.id} has the version ${JSON.stringify(published.version)}, which is not SemVer.`,
      );
    }
    if (channelOfVersion(published.version) !== channel) {
      throw new Error(
        `${ERROR_PREFIX} ${published.id}@${published.version} does not belong on the ${channel} channel.`,
      );
    }

    const entry = next.packages[published.id] ?? emptyPackage();
    const existing = entry.releases[published.version];
    const release: UpdateRelease = { ...existing };
    release.publishedAt ??= githubRelease?.publishedAt;
    release.url ??= githubRelease?.url;
    release.requiresCore ??= published.requiresCore;
    entry.releases[published.version] = Object.fromEntries(
      Object.entries(release).filter(([, value]) => value !== undefined),
    );

    const current = entry.channels[channel];
    if (current === undefined || gt(published.version, current)) {
      entry.channels[channel] = published.version;
    }

    next.packages[published.id] = entry;
  }

  return assertValid(next);
};

export const securityUpdatesInputSchema = z.strictObject({
  schemaVersion: z.literal(UPDATE_MANIFEST_SCHEMA_VERSION),
  securityUpdates: z.record(
    z.string().refine(isPackageId, { message: "Expected an npm package name" }),
    z.array(securityUpdateSchema),
  ),
});

export type SecurityUpdatesInput = z.infer<typeof securityUpdatesInputSchema>;

export const parseSecurityUpdatesInput = (
  text: string,
): SecurityUpdatesInput => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${ERROR_PREFIX} The security updates file is not JSON.`);
  }

  const parsed = securityUpdatesInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `${ERROR_PREFIX} The security updates file is invalid: ${parsed.error.issues
        .slice(0, 5)
        .map(issue => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return parsed.data;
};

/**
 * The maintained security updates file is the whole truth about security updates: each
 * package gets exactly the list it declares, and a package it does not list has
 * none. Releases and channels are untouched.
 */
export const applySecurityUpdates = (
  manifest: UpdateManifest,
  input: SecurityUpdatesInput,
): UpdateManifest => {
  const next: UpdateManifest = structuredClone(manifest);

  for (const entry of Object.values(next.packages)) entry.securityUpdates = [];
  for (const [id, securityUpdates] of Object.entries(input.securityUpdates)) {
    const entry = next.packages[id] ?? emptyPackage();
    entry.securityUpdates = securityUpdates;
    next.packages[id] = entry;
  }

  return assertValid(next);
};

/**
 * `workspace:*` becomes the exact version on publish, `workspace:^` a caret
 * range and so on - the same rewrite pnpm does - so a plugin's declared
 * dependency on core is what its release says it requires.
 */
export const requiresCoreFrom = (
  spec: string | undefined,
  coreVersion: string,
): string | undefined => {
  if (spec === undefined) return undefined;
  if (!spec.startsWith("workspace:")) return spec;

  const rest = spec.slice("workspace:".length);
  if (rest === "*" || rest === "") return coreVersion;
  if (rest === "^" || rest === "~") return `${rest}${coreVersion}`;

  return rest;
};
