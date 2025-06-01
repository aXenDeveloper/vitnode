/* eslint-disable no-console */
import chokidar from 'chokidar';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { basename, join, relative } from 'path';

import {
  buildInitialRouteMap,
  copyFile,
  findLocaleRoot,
  findRepoRoot,
  getAllFiles,
  isDirectoryEmpty,
  routeKey,
  type SourceConfig,
} from './shared/file-utils';

export const processPlugin = ({ initMessage }: { initMessage: string }) => {
  const pluginDir = process.cwd();
  const repoRoot = findRepoRoot(pluginDir);
  const localeRoot = findLocaleRoot(repoRoot);
  const routeMap = buildInitialRouteMap(localeRoot);

  // Get the package name from package.json for imports
  let pluginName = basename(pluginDir);
  try {
    const packageJsonPath = join(pluginDir, 'package.json');

    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      pluginName = packageJson.name ?? '';
    }
  } catch (error) {
    console.error(`\x1b[31mError reading package.json:\x1b[0m`, error);

    return;
  }

  // Transform plugin name for path usage
  const pluginPathName = pluginName.replace(/\//g, '-').replace(/@/g, '');

  const mainDest = join(
    repoRoot,
    'apps',
    'web',
    'src',
    'app',
    '[locale]',
    '(main)',
    join('(plugins)', `(${pluginPathName})`),
  );
  const adminDest = join(
    repoRoot,
    'apps',
    'web',
    'src',
    'app',
    '[locale]',
    'admin',
    '(auth)',
    join('(plugins)', `(${pluginPathName})`),
  );
  const langDest = join(repoRoot, 'apps', 'web', 'src', 'langs', pluginName);

  // tell the copier about both trees
  const sources: SourceConfig[] = [
    {
      sourceDir: join(pluginDir, 'src', 'app_admin'),
      destinationDir: adminDest,
    },
    { sourceDir: join(pluginDir, 'src', 'app'), destinationDir: mainDest },
    { sourceDir: join(pluginDir, 'src', 'langs'), destinationDir: langDest },
  ];

  // Create destination directories if they don't exist and source directories are not empty
  for (const { sourceDir, destinationDir } of sources) {
    if (
      existsSync(sourceDir) &&
      !isDirectoryEmpty(sourceDir) &&
      !existsSync(destinationDir)
    ) {
      mkdirSync(destinationDir, { recursive: true });
    }
  }

  const copyFileWrapper = (srcPath: string, destPath: string) => {
    copyFile(srcPath, destPath, pluginName, routeMap, localeRoot, repoRoot);
  };

  const removeFile = (filePath: string) => {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`\x1b[33mRemoved:\x1b[0m ${filePath}`);

        if (/^page\.(tsx|ts|jsx|js)$/i.test(basename(filePath))) {
          const key = routeKey(filePath, localeRoot);
          // only delete if this exact file is the one in the map
          if (routeMap.get(key) === filePath) {
            routeMap.delete(key);
          }
        }
      }
    } catch (error) {
      console.error(`\x1b[31mError removing file:\x1b[0m ${filePath}`, error);
    }
  };

  const cleanupDeletedFiles = (sourceDir: string, destinationDir: string) => {
    if (!existsSync(destinationDir)) return;

    const destFiles = getAllFiles(destinationDir);
    for (const destFile of destFiles) {
      const relativePath = relative(destinationDir, destFile);
      const sourceFile = join(sourceDir, relativePath);

      if (!existsSync(sourceFile)) {
        removeFile(destFile);
      }
    }
  };

  // Clean up any files that were deleted while the script wasn't running
  // Clean up deleted files for each source directory
  for (const { sourceDir, destinationDir } of sources) {
    cleanupDeletedFiles(sourceDir, destinationDir);
  }

  console.log(
    `${initMessage} \x1b[34mWatching for changes in plugins...\x1b[0m`,
  );

  const sourceDirs = sources
    .map(s => s.sourceDir)
    .filter(dir => existsSync(dir) && !isDirectoryEmpty(dir));

  const watcher = chokidar.watch(sourceDirs, {
    ignoreInitial: false,
    persistent: true,
  });

  const getDestinationPath = (srcPath: string): string => {
    // collect all matching sourceConfigs
    const candidates = sources.filter(({ sourceDir }) =>
      srcPath.startsWith(sourceDir),
    );

    if (candidates.length === 0) {
      throw new Error(`No matching source directory for: ${srcPath}`);
    }

    // pick the one with the longest sourceDir (most specific)
    const sourceConfig = candidates.reduce((best, cur) =>
      cur.sourceDir.length > best.sourceDir.length ? cur : best,
    );

    // now append the relative path
    const relativePath = relative(sourceConfig.sourceDir, srcPath);

    return join(sourceConfig.destinationDir, relativePath);
  };

  watcher
    .on('add', filePath => {
      const destPath = getDestinationPath(filePath);
      copyFileWrapper(filePath, destPath);
    })
    .on('change', filePath => {
      const destPath = getDestinationPath(filePath);
      copyFileWrapper(filePath, destPath);
    })
    .on('unlink', filePath => {
      const destPath = getDestinationPath(filePath);
      removeFile(destPath);
    })
    .on('error', error => {
      console.error('\x1b[31mWatcher error:\x1b[0m', error);
    });
};
