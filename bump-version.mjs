// @ts-check

/**
 * VitNode Bump Version Script
 *
 * This script handles version bumping and file synchronization for VitNode packages.
 * It copies files and folders from the main web app to the create-vitnode-app template
 * and manages package version updates across the workspace.
 */

import path from 'path';
import {
  existsSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  statSync,
  readdirSync,
} from 'fs';
import { execSync, spawn } from 'child_process';
import { EOL } from 'os';

// Constants
const CONFIG = {
  ALLOWED_VERSION_TYPES: [
    'canary',
    'release-candidate',
    'major',
    'minor',
    'patch',
  ],
  PACKAGES_TO_BUMP: ['create-vitnode-app'],
  TAG_PREFIX: 'v',
  TAG_SUFFIX: '',
  COMMIT_MESSAGE: 'ci: version bump to {{version}}',
};

// Environment configuration with validation
class Environment {
  static validate() {
    const required = {
      WORKSPACE: process.env.GITHUB_WORKSPACE || process.cwd(),
      EVENT_PATH: process.env.GITHUB_EVENT_PATH,
      VERSION_TYPE: process.env.VERSION_TYPE,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    };

    Object.entries(required).forEach(([key, value]) => {
      if (!value)
        throw new Error(`Missing required environment variable: ${key}`);
    });

    return {
      ...required,
      RELEASE_TYPE: process.env.RELEASE_TYPE,
      GITHUB_HEAD_REF: process.env.GITHUB_HEAD_REF,
      GITHUB_REF: process.env.GITHUB_REF,
      GITHUB_ACTOR: process.env.GITHUB_ACTOR,
      GIT_USER: {
        NAME: process.env.GITHUB_USER ?? 'Automated Version Bump',
        EMAIL:
          process.env.GITHUB_EMAIL ??
          'gh-action-bump-version@users.noreply.github.com',
      },
    };
  }
}

// File System Operations
class FileSystem {
  static copyFile(from, to) {
    try {
      const destinationDir = path.dirname(to);
      if (!existsSync(destinationDir)) {
        mkdirSync(destinationDir, { recursive: true });
      }
      copyFileSync(from, to);
    } catch (error) {
      throw new Error(`Failed to copy file: ${from} → ${to}: ${error.message}`);
    }
  }

  static copyDirectoryExcludingPlugins(from, to) {
    try {
      if (!existsSync(to)) {
        mkdirSync(to, { recursive: true });
      }

      for (const item of readdirSync(from)) {
        if (item === '(plugins)') continue;

        const sourcePath = path.join(from, item);
        const destinationPath = path.join(to, item);
        const stats = statSync(sourcePath);

        if (stats.isDirectory()) {
          this.copyDirectoryExcludingPlugins(sourcePath, destinationPath);
        } else {
          copyFileSync(sourcePath, destinationPath);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to copy directory: ${from} → ${to}: ${error.message}`,
      );
    }
  }

  static validatePath(filePath, description) {
    if (existsSync(filePath)) return true;
    console.error(`✖ Missing ${description}: ${filePath}`);
    return false;
  }
}

// Version Management
class VersionManager {
  constructor(env) {
    this.env = env;
  }

  async init() {
    await this.validateSetup();
    const currentVersion = this.getCurrentVersion();
    const newVersion = await this.calculateNewVersion(currentVersion);
    await this.applyVersion(currentVersion, newVersion);
    await this.commitAndPush(newVersion);
  }

  getCurrentVersion() {
    const pkgJson = JSON.parse(
      readFileSync(
        path.join(
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

  async calculateNewVersion(currentVersion) {
    const versionType = this.getVersionType(currentVersion);
    const npmOutput = execSync(
      `npm version --git-tag-version=false --commit-hooks=false --workspaces --workspaces-update=false ${versionType}`,
    ).toString();
    return `${CONFIG.TAG_PREFIX}${this.parseNpmVersionOutput(npmOutput)}${CONFIG.TAG_SUFFIX}`;
  }

  getVersionType(currentVersion) {
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

  parseNpmVersionOutput(output) {
    return output.trim().split(EOL).pop().replace(/^v/, '');
  }

  async applyVersion(currentVersion, newVersion) {
    console.log(`Bumping version from ${currentVersion} to ${newVersion}`);
    await this.runNpmVersion(newVersion);
    await this.exposeNewVersion(newVersion);
  }

  async runNpmVersion(version) {
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

  async exposeNewVersion(version) {
    return this.runInWorkspace('sh', [
      '-c',
      `echo "newTag=${version}" >> $GITHUB_OUTPUT`,
    ]);
  }

  async commitAndPush(version) {
    const branch = await this.getCurrentBranch();
    await this.setupGit();
    await this.createCommit(version);
    await this.pushChanges(branch);
  }

  async getCurrentBranch() {
    const { GITHUB_HEAD_REF, GITHUB_REF } = this.env;
    if (GITHUB_HEAD_REF) return GITHUB_HEAD_REF;
    if (!GITHUB_REF) throw new Error('No branch found');

    const match = /refs\/[a-zA-Z]+\/(.*)/.exec(GITHUB_REF);
    if (!match?.[1]) throw new Error('Invalid branch reference');
    return match[1];
  }

  async setupGit() {
    const { GIT_USER } = this.env;
    await this.runInWorkspace('git', ['config', 'user.name', GIT_USER.NAME]);
    await this.runInWorkspace('git', ['config', 'user.email', GIT_USER.EMAIL]);
  }

  async createCommit(version) {
    await this.runInWorkspace('git', [
      'commit',
      '-a',
      '-m',
      CONFIG.COMMIT_MESSAGE.replace(/{{version}}/g, version),
    ]);
  }

  async pushChanges(branch) {
    const { GITHUB_ACTOR, GITHUB_TOKEN, GITHUB_REPOSITORY } = this.env;
    const remoteRepo = `https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`;
    await this.runInWorkspace('git', ['push', remoteRepo]);
  }

  /**
   * Runs a command in the workspace
   * @param {string} command - The command to run
   * @param {string[]} args - The arguments for the command
   * @returns {Promise<void>}
   */
  async runInWorkspace(command, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd: this.env.WORKSPACE });
      const errorMessages = [];

      child.on('error', reject);
      child.stderr.on('data', chunk => errorMessages.push(chunk));
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

  async validateSetup() {
    // Validate packages exist
    for (const pkg of CONFIG.PACKAGES_TO_BUMP) {
      if (
        !existsSync(
          path.join(this.env.WORKSPACE, 'packages', pkg, 'package.json'),
        )
      ) {
        throw new Error(`Package ${pkg} does not exist`);
      }
    }

    // Validate version type
    if (!CONFIG.ALLOWED_VERSION_TYPES.includes(this.env.VERSION_TYPE)) {
      throw new Error(
        `Invalid version type, expected one of: ${CONFIG.ALLOWED_VERSION_TYPES.join(', ')}, got: ${this.env.VERSION_TYPE}`,
      );
    }
  }
}

// File Copy Manager
class FileCopyManager {
  constructor(env) {
    this.env = env;
  }

  async init() {
    console.log(this.env.MODE, 'this.env.MODE');

    const sourcePath = path.join(this.env.WORKSPACE, 'apps', 'web');
    const destPath = path.join(
      this.env.WORKSPACE,
      'packages',
      'create-vitnode-app',
      'copy-of-vitnode-app',
      'root',
    );

    if (
      !FileSystem.validatePath(sourcePath, 'web app directory') ||
      !FileSystem.validatePath(destPath, 'copy-of-vitnode-app directory')
    ) {
      throw new Error('Required paths not found');
    }

    await this.copyFiles(sourcePath, destPath);
  }

  async copyFiles(sourcePath, destPath) {
    const files = [
      {
        from: path.join(sourcePath, 'src/app/[locale]'),
        to: path.join(destPath, 'src/app/[locale]'),
      },
      {
        from: path.join(sourcePath, 'src/app/favicon.ico'),
        to: path.join(destPath, 'src/app/favicon.ico'),
      },
      {
        from: path.join(sourcePath, 'src/app/global-error.tsx'),
        to: path.join(destPath, 'src/app/global-error.tsx'),
      },
      {
        from: path.join(sourcePath, 'src/app/globals.css'),
        to: path.join(destPath, 'src/app/globals.css'),
      },
      {
        from: path.join(sourcePath, 'src/app/layout.tsx'),
        to: path.join(destPath, 'src/app/layout.tsx'),
      },
      {
        from: path.join(sourcePath, 'src/app/not-found.tsx'),
        to: path.join(destPath, 'src/app/not-found.tsx'),
      },
      {
        from: path.join(sourcePath, 'src/app/api'),
        to: path.join(destPath, 'src/app/api'),
      },
      {
        from: path.join(sourcePath, 'tsconfig.json'),
        to: path.join(destPath, 'tsconfig.json'),
      },
      {
        from: path.join(sourcePath, 'postcss.config.mjs'),
        to: path.join(destPath, 'postcss.config.mjs'),
      },
      {
        from: path.join(sourcePath, '.gitignore'),
        to: path.join(destPath, '.gitignore'),
      },
    ];

    for (const { from, to } of files) {
      const stats = existsSync(from) ? statSync(from) : null;
      if (!stats) {
        console.warn(`⚠ Source does not exist: ${from}`);
        continue;
      }

      if (stats.isDirectory()) {
        FileSystem.copyDirectoryExcludingPlugins(from, to);
      } else {
        FileSystem.copyFile(from, to);
      }
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting VitNode version bump and file copy process...');
  const env = Environment.validate();

  const fileCopyManager = new FileCopyManager(env);
  await fileCopyManager.init();

  // const versionManager = new VersionManager(env);
  // await versionManager.init();

  console.log('✔ Process completed successfully! 🎉');
}

main();
