import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { EOL } from 'os';
import type { EnvironmentConfig } from './environment.ts';

interface Config {
  ALLOWED_VERSION_TYPES: string[];
  TAG_PREFIX: string;
  TAG_SUFFIX: string;
  COMMIT_MESSAGE: string;
}

const CONFIG: Config = {
  ALLOWED_VERSION_TYPES: [
    'canary',
    'release-candidate',
    'major',
    'minor',
    'patch',
  ],
  TAG_PREFIX: 'v',
  TAG_SUFFIX: '',
  COMMIT_MESSAGE: 'ci: version bump to {{version}}',
};

export class VersionManager {
  constructor(private env: EnvironmentConfig) {}

  async init(): Promise<void> {
    if (this.env.GITHUB_OPTION_MODE === 'publish') {
      console.log('Skipping version bump in publish mode');
      return;
    }

    await this.validateSetup();
    const currentVersion = this.getCurrentVersion();
    const newVersion = await this.calculateNewVersion(currentVersion);
    await this.applyVersion(currentVersion, newVersion);
    await this.commitAndPush(newVersion);
  }

  getCurrentVersion(): string {
    const pkgJson = JSON.parse(
      readFileSync(
        join(
          this.env.WORKSPACE,
          'packages',
          'create-vitnode-app',
          'package.json',
        ),
        'utf8',
      ),
    );

    if (!pkgJson.version) {
      throw new Error('No version found in package.json');
    }

    return pkgJson.version.toString();
  }

  async calculateNewVersion(currentVersion: string): Promise<string> {
    const versionType = this.getVersionType(currentVersion);
    const npmOutput = execSync(
      `npm version --git-tag-version=false --commit-hooks=false --workspaces --workspaces-update=false ${versionType}`,
    ).toString();
    return `${CONFIG.TAG_PREFIX}${this.parseNpmVersionOutput(npmOutput)}${CONFIG.TAG_SUFFIX}`;
  }

  getVersionType(currentVersion: string): string {
    const { RELEASE_TYPE, VERSION_TYPE } = this.env;

    if (RELEASE_TYPE === 'canary' || RELEASE_TYPE === 'release-candidate') {
      const type = RELEASE_TYPE === 'canary' ? 'canary' : 'rc';
      if (currentVersion.includes(type)) {
        return `prerelease --preid=${type}`;
      }
      switch (VERSION_TYPE) {
        case 'major':
          return `premajor --preid=${type}`;
        case 'minor':
          return `preminor --preid=${type}`;
        case 'patch':
          return `prepatch --preid=${type}`;
      }
    }
    return VERSION_TYPE;
  }

  parseNpmVersionOutput(output: string): string {
    const result = output.trim().split(EOL).pop();
    if (!result) {
      throw new Error('Failed to parse npm version output');
    }
    return result.replace(/^v/, '');
  }

  async applyVersion(
    currentVersion: string,
    newVersion: string,
  ): Promise<void> {
    console.log(`Bumping version from ${currentVersion} to ${newVersion}`);
    await this.runNpmVersion(newVersion);
    await this.exposeNewVersion(newVersion);
  }

  async runNpmVersion(version: string): Promise<void> {
    return this.runInWorkspace('npm', [
      'version',
      '--allow-same-version=true',
      '--git-tag-version=false',
      '--commit-hooks=false',
      '--workspaces',
      '--workspaces-update=false',
      version,
    ]);
  }

  async exposeNewVersion(version: string): Promise<void> {
    return this.runInWorkspace('sh', [
      '-c',
      `echo "newTag=${version}" >> $GITHUB_OUTPUT`,
    ]);
  }

  async commitAndPush(version: string): Promise<void> {
    const branch = await this.getCurrentBranch();
    await this.setupGit();
    await this.createCommit(version);
    await this.pushChanges(branch);
  }

  async getCurrentBranch(): Promise<string> {
    const { GITHUB_HEAD_REF, GITHUB_REF } = this.env;
    if (GITHUB_HEAD_REF) return GITHUB_HEAD_REF;
    if (!GITHUB_REF) throw new Error('No branch found');

    const match = /refs\/[a-zA-Z]+\/(.*)/.exec(GITHUB_REF);
    if (!match?.[1]) throw new Error('Invalid branch reference');
    return match[1];
  }

  async setupGit(): Promise<void> {
    const { GIT_USER } = this.env;
    await this.runInWorkspace('git', ['config', 'user.name', GIT_USER.NAME]);
    await this.runInWorkspace('git', ['config', 'user.email', GIT_USER.EMAIL]);
  }

  async createCommit(version: string): Promise<void> {
    await this.runInWorkspace('git', [
      'commit',
      '-a',
      '-m',
      CONFIG.COMMIT_MESSAGE.replace(/{{version}}/g, version),
    ]);
  }

  async pushChanges(branch: string): Promise<void> {
    const { GITHUB_ACTOR, GITHUB_TOKEN, GITHUB_REPOSITORY } = this.env;
    const remoteRepo = `https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`;
    await this.runInWorkspace('git', ['push', remoteRepo]);
  }

  /**
   * Runs a command in the workspace
   */
  async runInWorkspace(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd: this.env.WORKSPACE });
      const errorMessages: Buffer[] = [];

      child.on('error', reject);
      child.stderr.on('data', (chunk: Buffer) => errorMessages.push(chunk));
      child.on('exit', code => {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(
            new Error(
              `${errorMessages.join('')}${EOL}${command} exited with code ${code}`,
            ),
          );
        }
      });
    });
  }

  async validateSetup(): Promise<void> {
    // Validate version type
    if (!CONFIG.ALLOWED_VERSION_TYPES.includes(this.env.VERSION_TYPE)) {
      throw new Error(
        `Invalid version type, expected one of: ${CONFIG.ALLOWED_VERSION_TYPES.join(', ')}, got: ${this.env.VERSION_TYPE}`,
      );
    }
  }
}
