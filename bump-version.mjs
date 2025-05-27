// @ts-check

/**
 * VitNode Bump Version Script
 *
 * This script handles version bumping and file synchronization for VitNode packages.
 * It copies files and folders from the main web app to the create-vitnode-app template
 * and manages package version updates across the workspace.
 *
 * Features:
 * - Automated version bumping for workspace packages
 * - File synchronization between web app and template
 * - Support for different release types (stable, canary, release-candidate)
 * - Git operations and commit management
 * - Comprehensive error handling and logging
 *
 * Usage: node bump-version.mjs
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

// @ts-check
const ALLOWED_VERSION_TYPES = ['major', 'minor', 'patch'];
const WORKSPACE = process.env.GITHUB_WORKSPACE || process.cwd();
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const VERSION_TYPE = process.env.VERSION_TYPE;
const RELEASE_TYPE = process.env.RELEASE_TYPE;
const GITHUB_HEAD_REF = process.env.GITHUB_HEAD_REF;
const GITHUB_REF = process.env.GITHUB_REF;
const GITHUB_ACTOR = process.env.GITHUB_ACTOR;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GIT_USER = {
  NAME: process.env.GITHUB_USER ?? 'Automated Version Bump',
  EMAIL: process.env.GITHUB_EMAIL
    ? `${process.env.GITHUB_USER}@users.noreply.github.com`
    : 'gh-action-bump-version@users.noreply.github.com',
};
const PACKAGES_TO_BUMP = ['create-vitnode-app'];

/**
 * Copy a single file from source to destination
 * @param {string} from - Source file path
 * @param {string} to - Destination file path
 */
const copyFile = (from, to) => {
  try {
    // Ensure destination directory exists
    const destinationDir = path.dirname(to);
    if (!existsSync(destinationDir)) {
      mkdirSync(destinationDir, { recursive: true });
    }

    copyFileSync(from, to);
  } catch (error) {
    console.error(`✖ Failed to copy file: ${from} → ${to}`, error.message);
    throw error;
  }
};

/**
 * Recursively copy a directory from source to destination
 * @param {string} from - Source directory path
 * @param {string} to - Destination directory path
 */
const copyDirectory = (from, to) => {
  try {
    // Ensure destination directory exists
    if (!existsSync(to)) {
      mkdirSync(to, { recursive: true });
    }

    const items = readdirSync(from);

    for (const item of items) {
      const sourcePath = path.join(from, item);
      const destinationPath = path.join(to, item);
      const stats = statSync(sourcePath);

      if (stats.isDirectory()) {
        copyDirectory(sourcePath, destinationPath);
      } else {
        copyFileSync(sourcePath, destinationPath);
      }
    }
  } catch (error) {
    console.error(
      `✖ Failed to copy directory: ${from} → ${to}`,
      error.message,
    );
    throw error;
  }
};

/**
 * Copy files and folders based on configuration
 * @param {Array<{from: string, to: string, type?: 'file' | 'directory'}>} items - Items to copy
 */
const copyItems = items => {
  console.log('📦 Starting file copy process...');

  for (const item of items) {
    const { from, to, type } = item;

    // Use intelligent type detection if type is not specified
    const itemType = type || detectPathType(from, to);

    if (!existsSync(from)) {
      console.warn(
        `⚠ Source does not exist: ${from} (detected as ${itemType})`,
      );
      continue;
    }

    // Verify our detection matches reality
    const stats = statSync(from);
    const actualType = stats.isDirectory() ? 'directory' : 'file';

    if (itemType !== actualType) {
      console.log(
        `ℹ Type corrected: ${from} detected as ${itemType}, actually ${actualType}`,
      );
    }

    const finalType = actualType; // Use actual type for safety

    if (finalType === 'directory') {
      copyDirectoryExcludingPlugins(from, to);
    } else {
      copyFile(from, to);
    }
  }

  console.log('✔ File copy process completed');
};

/**
 * Recursively copy a directory from source to destination, excluding (plugins) folders
 * @param {string} from - Source directory path
 * @param {string} to - Destination directory path
 */
const copyDirectoryExcludingPlugins = (from, to) => {
  try {
    // Ensure destination directory exists
    if (!existsSync(to)) {
      mkdirSync(to, { recursive: true });
    }

    const items = readdirSync(from);

    for (const item of items) {
      // Skip (plugins) folders
      if (item === '(plugins)') {
        continue;
      }

      const sourcePath = path.join(from, item);
      const destinationPath = path.join(to, item);
      const stats = statSync(sourcePath);

      if (stats.isDirectory()) {
        copyDirectoryExcludingPlugins(sourcePath, destinationPath);
      } else {
        copyFileSync(sourcePath, destinationPath);
      }
    }
  } catch (error) {
    console.error(
      `✖ Failed to copy directory: ${from} → ${to}`,
      error.message,
    );
    throw error;
  }
};

const getPackageJson = packageName => {
  if (!WORKSPACE) {
    throw new Error('GITHUB_WORKSPACE is not defined.');
  }

  const PACKAGE_JSON = 'package.json';
  const pathToPackage = path.join(
    WORKSPACE,
    'packages',
    packageName,
    PACKAGE_JSON,
  );
  if (!existsSync(pathToPackage)) {
    throw new Error(`${PACKAGE_JSON} could not be found in ${packageName}.`);
  }

  const file = readFileSync(pathToPackage, 'utf8');
  return JSON.parse(file);
};

const runInWorkspace = (command, args, packageName) => {
  return new Promise((resolve, reject) => {
    if (!WORKSPACE) {
      reject(new Error('GITHUB_WORKSPACE is not defined.'));

      return;
    }

    console.log(
      'runInWorkspace | command:',
      command,
      'args:',
      args,
      'packagePath:',
      packageName,
    );
    const child = spawn(command, args, {
      cwd: packageName
        ? path.join(WORKSPACE, 'packages', packageName)
        : WORKSPACE,
    });
    let isDone = false;
    const errorMessages = [];
    child.on('error', error => {
      if (!isDone) {
        isDone = true;
        reject(error);
      }
    });
    child.stderr.on('data', chunk => errorMessages.push(chunk));
    child.on('exit', code => {
      if (!isDone) {
        if (code === 0) {
          // @ts-ignore
          resolve();
        } else {
          reject(
            `${errorMessages.join('')}${EOL}${command} exited with code ${code}`,
          );
        }
      }
    });
  });
};

function parseNpmVersionOutput(output) {
  const npmVersionStr = output.trim().split(EOL).pop();
  const version = npmVersionStr.replace(/^v/, '');
  return version;
}

function exitSuccess(message) {
  console.info(`✔  success   ${message}`);
  process.exit(0);
}

function exitFailure(message) {
  logError(message);
  process.exit(1);
}

function logError(error) {
  console.error(`✖  fatal     ${error.stack || error}`);
}

/**
 * Check if a path exists and log appropriate message
 * @param {string} filePath - Path to check
 * @param {string} description - Description for logging
 * @returns {boolean} - Whether the path exists
 */
const validatePath = (filePath, description) => {
  if (existsSync(filePath)) {
    return true;
  }
  console.error(`✖ Missing ${description}: ${filePath}`);
  return false;
};

/**
 * Get file copy configuration based on workspace structure
 * @param {string} sourcePath - Source directory path
 * @param {string} destinationPath - Destination directory path
 * @returns {Array} - Array of copy configurations
 */
const getFileCopyConfig = (sourcePath, destinationPath) => {
  return [
    createCopyItem(
      path.join(sourcePath, 'src', 'app', '[locale]'),
      path.join(destinationPath, 'src', 'app', '[locale]'),
    ),
    createCopyItem(
      path.join(sourcePath, 'src', 'app', 'favicon.ico'),
      path.join(destinationPath, 'src', 'app', 'favicon.ico'),
    ),
    createCopyItem(
      path.join(sourcePath, 'src', 'app', 'global-error.tsx'),
      path.join(destinationPath, 'src', 'app', 'global-error.tsx'),
    ),
    createCopyItem(
      path.join(sourcePath, 'src', 'app', 'globals.css'),
      path.join(destinationPath, 'src', 'app', 'globals.css'),
    ),
    createCopyItem(
      path.join(sourcePath, 'src', 'app', 'layout.tsx'),
      path.join(destinationPath, 'src', 'app', 'layout.tsx'),
    ),
    createCopyItem(
      path.join(sourcePath, 'src', 'app', 'not-found.tsx'),
      path.join(destinationPath, 'src', 'app', 'not-found.tsx'),
    ),
    createCopyItem(
      path.join(sourcePath, 'src', 'app', 'api'),
      path.join(destinationPath, 'src', 'app', 'api'),
    ),
    createCopyItem(
      path.join(sourcePath, 'tsconfig.json'),
      path.join(destinationPath, 'tsconfig.json'),
    ),
    createCopyItem(
      path.join(sourcePath, 'postcss.config.mjs'),
      path.join(destinationPath, 'postcss.config.mjs'),
    ),
    createCopyItem(
      path.join(sourcePath, '.gitignore'),
      path.join(destinationPath, '.gitignore'),
    ),
  ];
};

/**
 * Detect if a path is a file or directory based on the path itself and filesystem
 * @param {string} fromPath - Source path to analyze
 * @param {string} toPath - Destination path to analyze (optional, used for inference)
 * @returns {string} - 'file' or 'directory'
 */
const detectPathType = (fromPath, toPath = '') => {
  // First, check if the source path exists
  if (existsSync(fromPath)) {
    const stats = statSync(fromPath);
    return stats.isDirectory() ? 'directory' : 'file';
  }

  // If source doesn't exist, try to infer from the path structure
  const fromExtension = path.extname(fromPath);
  const toExtension = path.extname(toPath);

  // If either path has a file extension, it's likely a file
  if (fromExtension || toExtension) {
    return 'file';
  }

  // Check common file patterns (files without extensions)
  const fileName = path.basename(fromPath).toLowerCase();
  const commonFilesWithoutExtensions = [
    'dockerfile',
    'makefile',
    'readme',
    'license',
    'changelog',
    'gitignore',
    'gitattributes',
    'package-lock',
    'yarn.lock',
    'pnpm-lock',
  ];

  if (
    commonFilesWithoutExtensions.some(pattern => fileName.includes(pattern))
  ) {
    return 'file';
  }

  // Check if the parent directory exists and this looks like a file
  const parentDir = path.dirname(fromPath);
  if (existsSync(parentDir)) {
    // If parent exists and this item doesn't, it's likely a file being created
    const baseName = path.basename(fromPath);
    if (baseName.includes('.') && !baseName.startsWith('.')) {
      return 'file';
    }
  }

  // Default to directory if we can't determine
  console.log(
    `⚠ Could not determine type for ${fromPath}, defaulting to directory`,
  );
  return 'directory';
};

/**
 * Create a copy item configuration with automatic type detection
 * @param {string} from - Source path
 * @param {string} to - Destination path
 * @returns {Object} - Copy configuration object
 */
const createCopyItem = (from, to) => {
  return {
    from,
    to,
    type: detectPathType(from, to),
  };
};

/**
 * Test and display path type detection for debugging
 * @param {Array<{from: string, to: string, type?: string}>} items - Items to analyze
 */
const testPathDetection = items => {
  console.log('🔍 Path Type Detection Analysis:');
  console.log('=====================================');

  for (const item of items) {
    const { from, to, type } = item;
    const detectedType = detectPathType(from, to);
    const existsStatus = existsSync(from);
    const actualType = existsStatus
      ? statSync(from).isDirectory()
        ? 'directory'
        : 'file'
      : 'unknown';

    console.log(`Path: ${from}`);
    console.log(`  Exists: ${existsStatus ? '✔' : '✖'}`);
    console.log(`  Specified: ${type || 'auto'}`);
    console.log(`  Detected: ${detectedType}`);
    console.log(`  Actual: ${actualType}`);
    console.log(
      `  Match: ${detectedType === actualType ? '✔' : actualType === 'unknown' ? '?' : '✖'}`,
    );
    console.log('');
  }
};

const copyFiles = () => {
  const pathCopyOfVitNodeApp = path.join(
    WORKSPACE,
    'packages',
    'create-vitnode-app',
    'copy-of-vitnode-app',
    'root',
  );

  const pathWeb = path.join(WORKSPACE, 'apps', 'web');

  // Validate required paths
  if (!validatePath(pathCopyOfVitNodeApp, 'copy-of-vitnode-app directory')) {
    exitFailure(
      'Please ensure the create-vitnode-app package is set up correctly.',
    );
    return;
  }

  if (!validatePath(pathWeb, 'web app directory')) {
    exitFailure('Please ensure the web app is set up correctly.');
    return;
  }

  // Get file copy configuration
  const filesAndFoldersToCopy = getFileCopyConfig(
    pathWeb,
    pathCopyOfVitNodeApp,
  );

  try {
    copyItems(filesAndFoldersToCopy);
    exitSuccess('Files and folders copied successfully! 🎉');
  } catch (error) {
    exitFailure(`Failed to copy files and folders: ${error.message}`);
  }
};

const bumpVersion = async () => {
  // Check if packages exist
  for (const pkg of PACKAGES_TO_BUMP) {
    if (!existsSync(path.join(WORKSPACE, 'packages', pkg, 'package.json'))) {
      exitFailure(`Package ${pkg} does not exist`);
    }
  }

  // Check if the event is a push event
  if (!EVENT_PATH) {
    exitFailure('No event file found');

    return;
  }

  const eventPath = readFileSync(EVENT_PATH, 'utf8');
  const event = EVENT_PATH ? JSON.parse(eventPath) : {};
  if (!event.commits && !VERSION_TYPE) {
    console.log(
      "Couldn't find any commits in this event, incrementing patch version...",
    );
  }

  // Check if the version type is valid
  if (
    (VERSION_TYPE && !ALLOWED_VERSION_TYPES.includes(VERSION_TYPE)) ||
    !VERSION_TYPE
  ) {
    exitFailure(
      `Invalid version type, expected one of: ${ALLOWED_VERSION_TYPES.join(
        ', ',
      )}, got: ${VERSION_TYPE}`,
    );
    return;
  }

  // Check if the commit message contains a version bump
  const commitMessage = 'ci: version bump to {{version}}';
  const tagPrefix = 'v';
  const tagSuffix = '';
  const currentVersion = getPackageJson().version.toString();
  let version = VERSION_TYPE;

  // Process pre-version bump
  if (RELEASE_TYPE === 'canary' || RELEASE_TYPE === 'release-candidate') {
    const type = RELEASE_TYPE === 'canary' ? 'canary' : 'rc';
    if (currentVersion.includes(type)) {
      version = `prerelease --preid=${type}`;
    } else if (VERSION_TYPE === 'major') {
      version = `premajor --preid=${type}`;
    } else if (VERSION_TYPE === 'minor') {
      version = `preminor --preid=${type}`;
    } else if (VERSION_TYPE === 'patch') {
      version = `prepatch --preid=${type}`;
    }
  }

  // Set git user
  await runInWorkspace('git', ['config', 'user.name', GIT_USER.NAME]);
  await runInWorkspace('git', ['config', 'user.email', GIT_USER.EMAIL]);

  // Get the current branch
  let currentBranch;
  let isPullRequest = false;
  if (GITHUB_HEAD_REF) {
    // Comes from a pull request
    currentBranch = GITHUB_HEAD_REF;
    isPullRequest = true;
  } else {
    if (!GITHUB_REF) {
      exitFailure('No branch found');

      return;
    }

    let regexBranch = /refs\/[a-zA-Z]+\/(.*)/.exec(GITHUB_REF);
    // If GITHUB_REF is null then do not set the currentBranch
    currentBranch = regexBranch ? regexBranch[1] : undefined;
  }

  if (!currentBranch) {
    exitFailure('No branch found');
    return;
  }

  // Disable npm fund message, because that would break the output
  // -ws/iwr needed for workspaces https://github.com/npm/cli/issues/6099#issuecomment-1961995288
  await runInWorkspace('npm', [
    'config',
    'set',
    'fund',
    'false',
    '-ws=false',
    '-iwr',
  ]);

  // Do it in the currentVersion checked out github branch (DETACHED HEAD)
  // important for further usage of the package.json version
  await runInWorkspace('npm', [
    'version',
    '--allow-same-version=true',
    '--git-tag-version=false',
    '--commit-hooks=false',
    '--workspaces',
    '--workspaces-update=false',
    currentVersion,
  ]);

  // Download the new version
  let newVersion = parseNpmVersionOutput(
    execSync(
      `npm version --git-tag-version=false --commit-hooks=false --workspaces --workspaces-update=false ${version}`,
    ).toString(),
  );
  newVersion = `${tagPrefix}${newVersion}${tagSuffix}`;

  // Bump the version
  console.log(
    `Bumping version from ${currentVersion} to ${newVersion}`,
    version,
  );
  await runInWorkspace('npm', [
    'version',
    '--allow-same-version=true',
    '--git-tag-version=false',
    '--commit-hooks=false',
    '--workspaces',
    '--workspaces-update=false',
    newVersion,
  ]);

  // Expose the new version
  await runInWorkspace('sh', [
    '-c',
    `echo "newTag=${newVersion}" >> $GITHUB_OUTPUT`,
  ]);

  // Push the changes
  // now go to the actual branch to perform the same versioning
  if (isPullRequest) {
    // First fetch to get updated local version of branch
    await runInWorkspace('git', ['fetch']);
  }
  await runInWorkspace('git', ['checkout', currentBranch]);

  // Create a commit
  await runInWorkspace('git', [
    'commit',
    '-a',
    '-m',
    commitMessage.replace(/{{version}}/g, newVersion),
  ]);

  const remoteRepo = `https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`;
  await runInWorkspace('git', ['push', remoteRepo]);
};

const init = () => {
  console.log('🚀 Starting VitNode file copy process...');

  if (!WORKSPACE) {
    exitFailure('GITHUB_WORKSPACE is not defined.');
    return;
  }

  copyFiles();
  bumpVersion();
};

init();
