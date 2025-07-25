/* eslint-disable no-console */
import chokidar from 'chokidar';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from 'fs';
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

  // Detect app types by checking for config files
  const detectAppType = (appPath: string) => {
    const hasWebConfig = existsSync(join(appPath, 'src', 'vitnode.config.ts'));
    const hasApiConfig = existsSync(
      join(appPath, 'src', 'vitnode.api.config.ts'),
    );

    if (hasApiConfig && !hasWebConfig) return 'api';
    if (hasWebConfig) return 'web';

    return null;
  };

  // Check if we're in a monorepo by looking for apps directories
  const appsDir = join(repoRoot, 'apps');
  const isMonorepo = existsSync(appsDir);

  const sources: SourceConfig[] = [];

  if (isMonorepo) {
    // Monorepo: scan all apps and detect their types
    const appDirs = existsSync(appsDir)
      ? readdirSync(appsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name)
      : [];

    for (const appName of appDirs) {
      const appPath = join(repoRoot, 'apps', appName);
      const appType = detectAppType(appPath);

      if (appType === 'web') {
        // Web app: copy app, app_admin, and locales
        const mainDest = join(
          appPath,
          'src',
          'app',
          '[locale]',
          '(main)',
          join('(plugins)', `(${pluginPathName})`),
        );
        const adminDest = join(
          appPath,
          'src',
          'app',
          '[locale]',
          'admin',
          '(auth)',
          join('(plugins)', `(${pluginPathName})`),
        );
        const langDest = join(appPath, 'src', 'locales', pluginName);

        sources.push(
          {
            sourceDir: join(pluginDir, 'src', 'app_admin'),
            destinationDir: adminDest,
          },
          {
            sourceDir: join(pluginDir, 'src', 'app'),
            destinationDir: mainDest,
          },
          {
            sourceDir: join(pluginDir, 'src', 'locales'),
            destinationDir: langDest,
          },
        );
      } else if (appType === 'api') {
        // API app: copy only locales
        const apiLangDest = join(appPath, 'src', 'locales', pluginName);

        sources.push({
          sourceDir: join(pluginDir, 'src', 'locales'),
          destinationDir: apiLangDest,
        });
      }
    }
  } else {
    // Standalone project: check if we're running from within an app directory
    // or if we need to copy to the current working directory
    const cwd = process.cwd();
    const projectType = detectAppType(cwd);

    if (projectType === 'web') {
      // Web project: copy all files to current working directory
      const mainDest = join(
        cwd,
        'src',
        'app',
        '[locale]',
        '(main)',
        join('(plugins)', `(${pluginPathName})`),
      );
      const adminDest = join(
        cwd,
        'src',
        'app',
        '[locale]',
        'admin',
        '(auth)',
        join('(plugins)', `(${pluginPathName})`),
      );
      const langDest = join(cwd, 'src', 'locales', pluginName);

      sources.push(
        {
          sourceDir: join(pluginDir, 'src', 'app_admin'),
          destinationDir: adminDest,
        },
        {
          sourceDir: join(pluginDir, 'src', 'app'),
          destinationDir: mainDest,
        },
        {
          sourceDir: join(pluginDir, 'src', 'locales'),
          destinationDir: langDest,
        },
      );
    } else if (projectType === 'api') {
      // API project: copy only locales to current working directory
      const langDest = join(cwd, 'src', 'locales', pluginName);

      sources.push({
        sourceDir: join(pluginDir, 'src', 'locales'),
        destinationDir: langDest,
      });
    }
  }

  // tell the copier about both trees

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

    // Check if this is a locale directory - if so, skip cleanup to preserve other language files
    const isLocaleDir = destinationDir.includes(join('src', 'locales'));
    if (isLocaleDir) {
      return; // Skip cleanup for locale directories to preserve files from other plugins/languages
    }

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
    .filter(dir => existsSync(dir));

  const watcher = chokidar.watch(sourceDirs, {
    ignoreInitial: false,
    persistent: true,
  });

  const getDestinationPaths = (srcPath: string): string[] => {
    // collect all matching sourceConfigs
    const candidates = sources.filter(({ sourceDir }) => {
      // Ensure exact directory matching by checking if the path starts with sourceDir
      // followed by a path separator (or is exactly the sourceDir)
      const normalizedSrcPath = srcPath.replace(/\\/g, '/');
      const normalizedSourceDir = sourceDir.replace(/\\/g, '/');
      
      return (
        normalizedSrcPath === normalizedSourceDir ||
        normalizedSrcPath.startsWith(normalizedSourceDir + '/')
      );
    });

    if (candidates.length === 0) {
      throw new Error(`No matching source directory for: ${srcPath}`);
    }

    // Return all matching destination paths instead of just one
    return candidates.map(sourceConfig => {
      const relativePath = relative(sourceConfig.sourceDir, srcPath);

      return join(sourceConfig.destinationDir, relativePath);
    });
  };

  watcher
    .on('add', filePath => {
      const destPaths = getDestinationPaths(filePath);
      destPaths.forEach(destPath => {
        copyFileWrapper(filePath, destPath);
      });
    })
    .on('change', filePath => {
      const destPaths = getDestinationPaths(filePath);
      destPaths.forEach(destPath => {
        copyFileWrapper(filePath, destPath);
      });
    })
    .on('unlink', filePath => {
      const destPaths = getDestinationPaths(filePath);
      destPaths.forEach(destPath => {
        removeFile(destPath);
      });
    })
    .on('error', error => {
      console.error('\x1b[31mWatcher error:\x1b[0m', error);
    });
};
