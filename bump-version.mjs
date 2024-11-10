// @ts-check
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { EOL } from 'os';
import path, { join } from 'path';
import * as fs from 'fs';

const ALLOWED_VERSION_TYPES = ['major', 'minor', 'patch'];
const GIT_USER_NAME = process.env.GITHUB_USER || 'Automated Version Bump';
const GIT_USER_EMAIL =
  process.env.GITHUB_EMAIL || 'gh-action-bump-version@users.noreply.github.com';
const WORKSPACE = process.env.GITHUB_WORKSPACE || process.cwd();
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const VERSION_TYPE = process.env.VERSION_TYPE;
const RELEASE_TYPE = process.env.RELEASE_TYPE;
const GITHUB_HEAD_REF = process.env.GITHUB_HEAD_REF;
const GITHUB_REF = process.env.GITHUB_REF;
const GITHUB_ACTOR = process.env.GITHUB_ACTOR;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const packages = [
  'backend',
  'create-vitnode-app',
  'frontend',
  'shared',
  'eslint-config-typescript-vitnode',
  'backend-email-resend',
  'backend-email-smtp',
  'backend-ai-open-ai',
  'backend-ai-google',
];

const getPackageJson = () => {
  if (!WORKSPACE) {
    throw new Error('GITHUB_WORKSPACE is not defined.');
  }

  const PACKAGE_JSON = 'package.json';
  const pathToPackage = path.join(
    WORKSPACE,
    'packages',
    packages[0],
    PACKAGE_JSON,
  );
  if (!existsSync(pathToPackage)) {
    throw new Error(`${PACKAGE_JSON} could not be found.`);
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

(async () => {
  if (!WORKSPACE) {
    exitFailure('GITHUB_WORKSPACE is not defined.');
    return;
  }

  // Copy frontend files from app dir
  const frontendPackagePath = path.join(
    WORKSPACE,
    'packages',
    'frontend',
    'folders_to_copy',
  );
  const frontendAppPath = path.join(WORKSPACE, 'apps', 'frontend');
  const pathsToFoldersForce = [
    join('src', 'app', '[locale]', 'admin', '(vitnode)'),
    join('src', 'app', '[locale]', 'admin', '(auth)', '(vitnode)'),
    join('src', 'app', '[locale]', '(main)', '(layout)', '(vitnode)'),
  ];
  const pathsToFiles = [
    {
      folder: join('src', 'app'),
      file: 'not-found.tsx',
    },
    {
      folder: join('src', 'plugins', 'core', 'langs'),
      file: 'en.json',
    },
    {
      folder: join('src', 'plugins', 'admin', 'langs'),
      file: 'en.json',
    },
  ];

  // Create folder for apps in frontend package
  if (!fs.existsSync(frontendPackagePath)) {
    fs.mkdirSync(frontendPackagePath, { recursive: true });
  }

  // Copy folders
  pathsToFoldersForce.forEach(folder => {
    const appPath = join(frontendAppPath, folder);
    const packagePath = join(frontendPackagePath, folder);
    if (!fs.existsSync(packagePath)) {
      fs.mkdirSync(packagePath, { recursive: true });
    }

    fs.cpSync(appPath, packagePath, { recursive: true });
  });

  // Copy files
  pathsToFiles.forEach(file => {
    const appPath = join(frontendAppPath, file.folder, file.file);
    const packagePath = join(frontendPackagePath, file.folder, file.file);

    fs.cpSync(appPath, packagePath, {
      recursive: true,
    });
  });

  // Copy src in frontend to create-vitnode-app
  const createVitnodeAppPath = path.join(
    WORKSPACE,
    'packages',
    'create-vitnode-app',
    'templates',
    'basic',
    'apps',
    'frontend',
    'src',
  );
  const frontendSrcPath = path.join(WORKSPACE, 'apps', 'frontend', 'src');
  if (!fs.existsSync(createVitnodeAppPath)) {
    fs.mkdirSync(createVitnodeAppPath, { recursive: true });
  }

  fs.cpSync(frontendSrcPath, createVitnodeAppPath, {
    recursive: true,
  });

  if (process.argv[2] === '--without-bump-version') {
    exitSuccess('Folders & Files copied!');
    return;
  }

  try {
    // Check if packages exist
    for (const pkg of packages) {
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
    await runInWorkspace('git', ['config', 'user.name', GIT_USER_NAME]);
    await runInWorkspace('git', ['config', 'user.email', GIT_USER_EMAIL]);

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

    exitSuccess('Version bumped!');
  } catch (e) {
    logError(e);
    exitFailure('Failed to bump version');
  }
})();
