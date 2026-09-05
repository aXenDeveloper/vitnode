import { execSync, spawn } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { EOL } from "node:os";
import { join } from "node:path";
import type { EnvironmentConfig } from "./environment.ts";

interface Config {
  ALLOWED_VERSION_TYPES: string[];
  TAG_PREFIX: string;
  TAG_SUFFIX: string;
  COMMIT_MESSAGE: string;
  SOURCE_OF_TRUTH_PACKAGE: string;
}

const CONFIG: Config = {
  ALLOWED_VERSION_TYPES: ["major", "minor", "patch"],
  TAG_PREFIX: "v",
  TAG_SUFFIX: "",
  COMMIT_MESSAGE: "ci: version bump to {{version}}",
  SOURCE_OF_TRUTH_PACKAGE: "create-vitnode-app",
};

export class VersionManager {
  constructor(private env: EnvironmentConfig) {}

  async init(): Promise<void> {
    if (this.env.GITHUB_OPTION_MODE === "publish") {
      console.log("Skipping version bump in publish mode");
      return;
    }

    this.validateSetup();
    const currentVersion = this.getCurrentVersion();
    const newVersion = this.calculateNewVersion(currentVersion);
    await this.applyVersion(currentVersion, newVersion);
    await this.commitAndPush(newVersion);
  }

  getCurrentVersion(): string {
    const pkgJson = JSON.parse(
      readFileSync(
        join(
          this.env.WORKSPACE,
          "packages",
          CONFIG.SOURCE_OF_TRUTH_PACKAGE,
          "package.json",
        ),
        "utf8",
      ),
    );

    if (!pkgJson.version) {
      throw new Error("No version found in package.json");
    }

    return pkgJson.version.toString();
  }

  calculateNewVersion(currentVersion: string) {
    const versionType = this.getVersionType(currentVersion);
    execSync(
      `npm version --git-tag-version=false --commit-hooks=false --workspace=${CONFIG.SOURCE_OF_TRUTH_PACKAGE} --workspaces-update=false ${versionType}`,
      { cwd: this.env.WORKSPACE },
    );

    const newVersion = this.getCurrentVersion();
    if (newVersion === currentVersion) {
      throw new Error(
        `npm version left ${CONFIG.SOURCE_OF_TRUTH_PACKAGE} at ${currentVersion}`,
      );
    }

    return `${CONFIG.TAG_PREFIX}${newVersion}${CONFIG.TAG_SUFFIX}`;
  }

  getVersionType(currentVersion: string): string {
    const { RELEASE_TYPE, VERSION_TYPE } = this.env;

    if (RELEASE_TYPE === "canary" || RELEASE_TYPE === "release-candidate") {
      const type = RELEASE_TYPE === "canary" ? "canary" : "rc";
      if (currentVersion.includes(type)) {
        return `prerelease --preid=${type}`;
      }
      switch (VERSION_TYPE) {
        case "major":
          return `premajor --preid=${type}`;
        case "minor":
          return `preminor --preid=${type}`;
        case "patch":
          return `prepatch --preid=${type}`;
      }
    }
    return VERSION_TYPE;
  }

  async applyVersion(
    currentVersion: string,
    newVersion: string,
  ): Promise<void> {
    console.log(`Bumping version from ${currentVersion} to ${newVersion}`);
    await this.runNpmVersion(newVersion);
    this.updateConfigVersion(newVersion);
    this.exposeNewVersion(newVersion);
  }

  updateConfigVersion(version: string): void {
    const configPath = join(
      this.env.WORKSPACE,
      "packages",
      "vitnode",
      "src",
      "config.ts",
    );
    const cleanVersion = version.replace(/^v/, "");
    const content = readFileSync(configPath, "utf8");
    const updated = content.replace(
      /(version:\s*")[^"]*(")/,
      `$1${cleanVersion}$2`,
    );

    if (updated === content) {
      throw new Error(`Failed to update version in ${configPath}`);
    }

    writeFileSync(configPath, updated);
    console.log(`Updated config version to ${cleanVersion}`);
  }

  runNpmVersion(version: string) {
    return this.runInWorkspace("npm", [
      "version",
      "--allow-same-version=true",
      "--git-tag-version=false",
      "--commit-hooks=false",
      "--workspaces",
      "--workspaces-update=false",
      version,
    ]);
  }

  exposeNewVersion(version: string): void {
    const outputPath = process.env.GITHUB_OUTPUT;
    if (!outputPath) {
      console.warn("GITHUB_OUTPUT is not set; skipping newTag output");
      return;
    }
    appendFileSync(outputPath, `newTag=${version}${EOL}`);
    console.log(`Exposed newTag=${version}`);
  }

  async commitAndPush(version: string): Promise<void> {
    const branch = this.getCurrentBranch();
    await this.setupGit();
    await this.createCommit(version);
    await this.pushChanges(branch);
  }

  getCurrentBranch() {
    const { GITHUB_HEAD_REF, GITHUB_REF } = this.env;
    if (GITHUB_HEAD_REF) return GITHUB_HEAD_REF;
    if (!GITHUB_REF) throw new Error("No branch found");

    const match = /refs\/[a-zA-Z]+\/(.*)/.exec(GITHUB_REF);
    if (!match?.[1]) throw new Error("Invalid branch reference");
    return match[1];
  }

  async setupGit(): Promise<void> {
    const { GIT_USER } = this.env;
    await this.runInWorkspace("git", ["config", "user.name", GIT_USER.NAME]);
    await this.runInWorkspace("git", ["config", "user.email", GIT_USER.EMAIL]);
  }

  async createCommit(version: string): Promise<void> {
    // Stage everything, including files newly copied into the template
    // (`git commit -a` would only pick up modifications to already-tracked files).
    await this.runInWorkspace("git", ["add", "-A"]);
    await this.runInWorkspace("git", [
      "commit",
      "-m",
      CONFIG.COMMIT_MESSAGE.replace(/{{version}}/g, version),
    ]);
  }

  async pushChanges(branch: string): Promise<void> {
    const { GITHUB_ACTOR, GITHUB_TOKEN, GITHUB_REPOSITORY } = this.env;
    const remoteRepo = `https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`;
    // push the branch and set upstream so future pushes can be done with just `git push`
    await this.runInWorkspace("git", [
      "push",
      "--set-upstream",
      remoteRepo,
      branch,
    ]);
  }

  /**
   * Runs a command in the workspace
   */
  async runInWorkspace(command: string, args: string[]): Promise<void> {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd: this.env.WORKSPACE });
      const errorMessages: Buffer[] = [];

      child.on("error", reject);
      child.stderr.on("data", (chunk: Buffer) => errorMessages.push(chunk));
      child.on("exit", (code) => {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(
            new Error(
              `${errorMessages.join("")}${EOL}${command} exited with code ${code}`,
            ),
          );
        }
      });
    });
  }

  validateSetup() {
    // Validate version type
    if (!CONFIG.ALLOWED_VERSION_TYPES.includes(this.env.VERSION_TYPE)) {
      throw new Error(
        `Invalid version type, expected one of: ${CONFIG.ALLOWED_VERSION_TYPES.join(", ")}, got: ${this.env.VERSION_TYPE}`,
      );
    }
  }
}
