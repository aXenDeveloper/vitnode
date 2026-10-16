import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { UpdateManifest } from "../../packages/vitnode/src/lib/updates/manifest.ts";
import type {
  GitHubReleaseMetadata,
  PublishedPackage,
} from "../../packages/vitnode/scripts/update-manifest/merge.ts";

import {
  applySecurityUpdates,
  channelForReleaseType,
  mergeRelease,
  parseSecurityUpdatesInput,
  readPublishedManifest,
  requiresCoreFrom,
  serializeUpdateManifest,
} from "../../packages/vitnode/scripts/update-manifest/merge.ts";

/**
 * Publishes VitNode's official update manifest to the `update-manifest` branch,
 * served at https://raw.githubusercontent.com/<repo>/update-manifest/updates.json.
 *
 *   release     after a successful npm publish: adds the published versions
 *   security-updates  replaces the security updates with `security/security-updates.json`
 *   check       validates `security/security-updates.json` and exits
 *
 * Every write fetches the branch, merges, and pushes; a push that loses a race
 * is retried from a fresh fetch, so concurrent runs cannot overwrite each other.
 */

const BRANCH = process.env.UPDATE_MANIFEST_BRANCH ?? "update-manifest";
const FILE = "updates.json";
const SECURITY_UPDATES_FILE = join("security", "security-updates.json");
const MAX_PUSH_ATTEMPTS = 5;
const CORE_ID = "@vitnode/core";

const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);

  return value;
};

const run = (
  command: string,
  args: string[],
  options: { cwd?: string; allowFailure?: boolean } = {},
): null | string => {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (options.allowFailure) return null;
    // The remote URL carries the token; never echo the arguments.
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error
        ? String(error.stderr).replaceAll(/x-access-token:[^@]+@/g, "***@")
        : "";
    throw new Error(`\`${command} ${args[0] ?? ""}\` failed. ${stderr}`.trim());
  }
};

interface WorkspacePackage {
  dependencies: Record<string, string>;
  name: string;
  updatesUrl: null | string;
  version: null | string;
}

const readWorkspacePackages = (): Map<string, WorkspacePackage> => {
  const packages = new Map<string, WorkspacePackage>();

  for (const group of ["packages", "plugins", "apps"]) {
    const root = join(workspace, group);
    if (!existsSync(root)) continue;

    for (const dir of readdirSync(root)) {
      const file = join(root, dir, "package.json");
      if (!existsSync(file)) continue;

      const json = JSON.parse(readFileSync(file, "utf8")) as {
        dependencies?: Record<string, string>;
        name?: string;
        peerDependencies?: Record<string, string>;
        version?: string;
        vitnode?: { updates?: { url?: string } };
      };
      if (!json.name) continue;

      packages.set(json.name, {
        dependencies: { ...json.peerDependencies, ...json.dependencies },
        name: json.name,
        updatesUrl: json.vitnode?.updates?.url ?? null,
        version: json.version ?? null,
      });
    }
  }

  return packages;
};

const githubReleaseFor = (
  repository: string,
  tag: string,
): GitHubReleaseMetadata | null => {
  const output = run(
    "gh",
    [
      "release",
      "view",
      tag,
      "--repo",
      repository,
      "--json",
      "publishedAt,url,isDraft",
    ],
    { allowFailure: true },
  );
  if (output === null) return null;

  const release = JSON.parse(output) as {
    isDraft?: boolean;
    publishedAt?: null | string;
    url?: string;
  };
  if (release.isDraft || !release.publishedAt || !release.url) return null;

  return { publishedAt: release.publishedAt, url: release.url };
};

/**
 * The packages this run published that point at this feed. A package that is
 * published but declares another update source - or none - is not ours to
 * advertise here.
 */
const publishedPackages = (feedUrl: string): PublishedPackage[] => {
  const names = requireEnv("PUBLISHED_PACKAGES").split(/\s+/).filter(Boolean);
  const workspacePackages = readWorkspacePackages();
  const coreVersion = workspacePackages.get(CORE_ID)?.version ?? null;

  return names.flatMap(name => {
    const pkg = workspacePackages.get(name);
    if (!pkg) throw new Error(`${name} is not a package in this workspace.`);
    if (pkg.updatesUrl?.toLowerCase() !== feedUrl.toLowerCase()) return [];
    if (!pkg.version) throw new Error(`${name} has no version.`);

    const requiresCore =
      name === CORE_ID || coreVersion === null
        ? undefined
        : requiresCoreFrom(pkg.dependencies[CORE_ID], coreVersion);

    return [{ id: name, requiresCore, version: pkg.version }];
  });
};

const publishToBranch = ({
  message,
  repository,
  token,
  update,
}: {
  message: string;
  repository: string;
  token: string;
  update: (manifest: UpdateManifest) => UpdateManifest;
}): void => {
  const remote =
    process.env.UPDATE_MANIFEST_REMOTE ??
    `https://x-access-token:${token}@github.com/${repository}.git`;

  for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
    const dir = mkdtempSync(join(tmpdir(), "vitnode-update-manifest-"));
    try {
      run("git", ["init", "--quiet"], { cwd: dir });
      run("git", ["remote", "add", "origin", remote], { cwd: dir });
      run("git", ["config", "user.name", "github-actions[bot]"], { cwd: dir });
      run(
        "git",
        [
          "config",
          "user.email",
          "41898282+github-actions[bot]@users.noreply.github.com",
        ],
        { cwd: dir },
      );

      const fetched =
        run("git", ["fetch", "--quiet", "--depth", "1", "origin", BRANCH], {
          allowFailure: true,
          cwd: dir,
        }) !== null;
      if (fetched) {
        run("git", ["checkout", "--quiet", "-B", BRANCH, "FETCH_HEAD"], {
          cwd: dir,
        });
      } else {
        // First publication: a branch with nothing but the manifest on it.
        run("git", ["checkout", "--quiet", "--orphan", BRANCH], { cwd: dir });
      }

      const path = join(dir, FILE);
      const before = existsSync(path) ? readFileSync(path, "utf8") : null;
      const after = serializeUpdateManifest(
        update(readPublishedManifest(before)),
      );

      if (before === after) {
        console.log("updates.json is already up to date - nothing to push.");

        return;
      }

      writeFileSync(path, after);
      run("git", ["add", FILE], { cwd: dir });
      run("git", ["commit", "--quiet", "-m", message], { cwd: dir });

      const pushed =
        run("git", ["push", "--quiet", "origin", `HEAD:${BRANCH}`], {
          allowFailure: true,
          cwd: dir,
        }) !== null;
      if (pushed) {
        console.log(`Published ${FILE} to ${BRANCH}.`);

        return;
      }

      console.warn(
        `Push attempt ${String(attempt)} was rejected - another run published first. Merging again.`,
      );
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }

  throw new Error(
    `Could not publish ${FILE} after ${String(MAX_PUSH_ATTEMPTS)} attempts.`,
  );
};

const readSecurityUpdates = () =>
  parseSecurityUpdatesInput(
    readFileSync(join(workspace, SECURITY_UPDATES_FILE), "utf8"),
  );

const main = () => {
  const mode = process.argv[2];

  if (mode === "check") {
    const input = readSecurityUpdates();
    const count = Object.values(input.securityUpdates).flat().length;
    console.log(
      `${SECURITY_UPDATES_FILE} is valid (${String(count)} security updates).`,
    );

    return;
  }

  const repository = requireEnv("GITHUB_REPOSITORY");
  const token = requireEnv("GITHUB_TOKEN");
  const feedUrl = `https://raw.githubusercontent.com/${repository}/${BRANCH}/${FILE}`;

  if (mode === "security-updates") {
    const input = readSecurityUpdates();
    publishToBranch({
      message: "chore: update security updates",
      repository,
      token,
      update: manifest => applySecurityUpdates(manifest, input),
    });

    return;
  }

  if (mode === "release") {
    const channel = channelForReleaseType(requireEnv("RELEASE_TYPE"));
    const packages = publishedPackages(feedUrl);
    if (packages.length === 0) {
      console.log("No published package points at this update manifest.");

      return;
    }

    const coreVersion =
      packages.find(pkg => pkg.id === CORE_ID)?.version ?? packages[0]?.version;
    // Releases are tagged v<version> by the bump script; a run that skipped the
    // GitHub Release simply finds none, and the entry goes out without a date.
    const githubRelease = coreVersion
      ? githubReleaseFor(repository, `v${coreVersion}`)
      : null;
    if (githubRelease === null) {
      console.log(
        "No published GitHub Release for this version - publishedAt and the release URL are left out.",
      );
    }

    publishToBranch({
      message: `chore: publish ${packages
        .map(pkg => `${pkg.id}@${pkg.version}`)
        .join(", ")} to ${channel}`,
      repository,
      token,
      update: manifest =>
        mergeRelease(manifest, { channel, githubRelease, packages }),
    });

    return;
  }

  throw new Error(
    "Usage: publish-update-manifest.ts <release | security-updates | check>",
  );
};

try {
  main();
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
