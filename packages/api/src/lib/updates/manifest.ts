import { parse, prerelease, satisfies, valid, validRange } from "semver";
import { z } from "zod";

import { isHttpsUrl } from "./source-url";

export const UPDATE_MANIFEST_SCHEMA_VERSION = 1;

export const UPDATE_CHANNELS = ["stable", "rc", "canary"] as const;
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number];

// npm package names: optional `@scope/`, lowercase, URL-safe, at most 214 chars.
const PACKAGE_ID = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;

const SECURITY_UPDATE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

export const isPackageId = (value: string): boolean =>
  value.length <= 214 && PACKAGE_ID.test(value);

/** A full SemVer version, written the way `semver` normalizes it. */
export const isStrictVersion = (value: string): boolean =>
  valid(value) === value;

export const isVersionRange = (value: string): boolean =>
  value.trim() !== "" && value.length <= 256 && validRange(value) !== null;

const httpsUrl = z
  .string()
  .refine(isHttpsUrl, { message: "Expected an https:// URL" });

const version = z
  .string()
  .max(256)
  .refine(isStrictVersion, { message: "Expected a SemVer version" });

const range = z
  .string()
  .refine(isVersionRange, { message: "Expected a SemVer range" });

export const updateReleaseSchema = z.strictObject({
  publishedAt: z.iso.datetime({ offset: true }).optional(),
  requiresCore: range.optional(),
  url: httpsUrl.optional(),
});

export const securityUpdateSchema = z.strictObject({
  id: z.string().regex(SECURITY_UPDATE_ID, {
    message: "Expected letters, digits, '.', '_', ':' or '-' (max 100)",
  }),
  affected: range,
  fixed: version.optional(),
  url: httpsUrl,
});

const MAX_RELEASES = 2000;
const MAX_SECURITY_UPDATES = 500;
const MAX_PACKAGES = 500;

export const updatePackageSchema = z
  .strictObject({
    channels: z.partialRecord(z.enum(UPDATE_CHANNELS), version).default({}),
    releases: z
      .record(version, updateReleaseSchema)
      .default({})
      .refine(releases => Object.keys(releases).length <= MAX_RELEASES, {
        message: `At most ${MAX_RELEASES} releases per package`,
      }),
    securityUpdates: z
      .array(securityUpdateSchema)
      .max(MAX_SECURITY_UPDATES)
      .default([]),
  })
  .superRefine((entry, ctx) => {
    for (const channel of UPDATE_CHANNELS) {
      const target = entry.channels[channel];
      if (target === undefined) continue;

      if (!Object.hasOwn(entry.releases, target)) {
        ctx.addIssue({
          code: "custom",
          message: `Channel "${channel}" points to ${target}, which has no entry in "releases"`,
          path: ["channels", channel],
        });
      }
      if (channel === "stable" && prerelease(target) !== null) {
        ctx.addIssue({
          code: "custom",
          message: `The stable channel cannot point to the prerelease ${target}`,
          path: ["channels", channel],
        });
      }
    }

    const ids = new Set<string>();
    entry.securityUpdates.forEach((securityUpdate, index) => {
      if (ids.has(securityUpdate.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Security update id "${securityUpdate.id}" is listed twice`,
          path: ["securityUpdates", index, "id"],
        });
      }
      ids.add(securityUpdate.id);
    });
  });

export const updateManifestSchema = z.strictObject({
  schemaVersion: z.literal(UPDATE_MANIFEST_SCHEMA_VERSION),
  packages: z
    .record(
      z
        .string()
        .refine(isPackageId, { message: "Expected an npm package name" }),
      updatePackageSchema,
    )
    .refine(packages => Object.keys(packages).length <= MAX_PACKAGES, {
      message: `At most ${MAX_PACKAGES} packages per manifest`,
    }),
});

export type UpdateRelease = z.infer<typeof updateReleaseSchema>;
export type SecurityUpdate = z.infer<typeof securityUpdateSchema>;
export type UpdatePackage = z.infer<typeof updatePackageSchema>;
export type UpdateManifest = z.infer<typeof updateManifestSchema>;

export type UpdateManifestParseResult =
  | { error: string; ok: false; reason: "invalid" | "unsupported_schema" }
  | { manifest: UpdateManifest; ok: true };

const describeIssues = (error: z.ZodError): string =>
  error.issues
    .slice(0, 5)
    .map(issue => {
      const path = issue.path.map(String).join(".");

      return path === "" ? issue.message : `${path}: ${issue.message}`;
    })
    .join("; ");

/**
 * Validates an update manifest. A `schemaVersion` this VitNode does not know is
 * reported on its own, before anything else is read: a future format may look
 * nothing like this one, and "unsupported" is more useful than fifty issues.
 */
export const parseUpdateManifest = (
  value: unknown,
): UpdateManifestParseResult => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      error: "The manifest is not a JSON object",
      ok: false,
      reason: "invalid",
    };
  }

  const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== UPDATE_MANIFEST_SCHEMA_VERSION) {
    return {
      error:
        typeof schemaVersion === "number"
          ? `Unsupported schemaVersion ${String(schemaVersion)}; this VitNode reads version ${String(UPDATE_MANIFEST_SCHEMA_VERSION)}`
          : `Missing or invalid schemaVersion; this VitNode reads version ${String(UPDATE_MANIFEST_SCHEMA_VERSION)}`,
      ok: false,
      reason: "unsupported_schema",
    };
  }

  const parsed = updateManifestSchema.safeParse(value);
  if (!parsed.success) {
    return {
      error: describeIssues(parsed.error),
      ok: false,
      reason: "invalid",
    };
  }

  return { manifest: parsed.data, ok: true };
};

/**
 * The channel an installed version is on, read from its prerelease tag:
 * `2.1.0` is stable, `2.1.0-rc.1` is rc and `2.1.0-canary.4` is canary. Any
 * other prerelease (`-beta.1`) is on no channel this format knows - the
 * installation has to say which one it follows.
 */
export const channelOfVersion = (value: string): null | UpdateChannel => {
  const parsed = parse(value);
  if (parsed === null) return null;

  const [tag] = parsed.prerelease;
  if (tag === undefined) return "stable";
  if (typeof tag !== "string") return null;
  if (tag === "rc" || tag.startsWith("rc")) return "rc";
  if (tag === "canary" || tag.startsWith("canary")) return "canary";

  return null;
};

/**
 * Security update ranges are matched with prereleases included: `2.1.3-canary.1`
 * comes before `2.1.3`, so it is inside `<2.1.3`. Without this, `semver`
 * would leave every prerelease out of an ordinary range and a canary build
 * of a vulnerable line would never be warned about.
 */
export const versionInRange = (value: string, rangeValue: string): boolean =>
  satisfies(value, rangeValue, { includePrerelease: true });
