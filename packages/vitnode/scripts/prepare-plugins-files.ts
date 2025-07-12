/* eslint-disable no-console */
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, relative } from 'path';

import { getConfig } from './get-config';
import {
  buildInitialRouteMap,
  copyDirectoryRecursive,
  findLocaleRoot,
  findRepoRoot,
  isDirectoryEmpty,
  type SourceConfig,
} from './shared/file-utils';

export const preparePluginsFiles = async () => {
  const config = await getConfig({});
  const plugins: string[] = [
    ...config.plugins.map(plugin => plugin.pluginId),
    '@vitnode/core',
  ];

  const repoRoot = findRepoRoot(process.cwd());
  const localeRoot = findLocaleRoot(repoRoot);
  const routeMap = buildInitialRouteMap(localeRoot);

  // For both monorepo apps and standalone projects: use current directory as base
  const baseDir = process.cwd();

  const findPluginPath = (pluginName: string): null | string => {
    const cwd = process.cwd();

    // Check in current working directory first
    const cwdPluginPath = join(cwd, 'node_modules', pluginName);
    if (existsSync(cwdPluginPath)) {
      return cwdPluginPath;
    }

    // Check in monorepo root if it exists and is different from cwd
    if (repoRoot && repoRoot !== cwd) {
      const rootPluginPath = join(repoRoot, 'node_modules', pluginName);
      if (existsSync(rootPluginPath)) {
        return rootPluginPath;
      }
    }

    return null;
  };

  await Promise.all(
    plugins.map(async pluginName => {
      const pluginPath = findPluginPath(pluginName);

      if (!pluginPath) {
        console.error(
          `\x1b[31mPlugin not found:\x1b[0m ${pluginName} in node_modules`,
        );

        return;
      }

      // Get the package name from package.json for imports
      let packageName = '';
      try {
        const packageJsonPath = join(pluginPath, 'package.json');
        if (existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(
            await readFile(packageJsonPath, 'utf-8'),
          );
          packageName = packageJson.name ?? '';
        }
      } catch (error) {
        console.error(
          `\x1b[31mError reading package.json for ${pluginName}:\x1b[0m`,
          error,
        );

        return;
      }

      // Transform plugin name for path usage
      const pluginPathName = pluginName.replace(/\//g, '-').replace(/@/g, '');

      // All projects (both monorepo apps and standalone) use the same structure
      const mainDest = join(
        baseDir,
        'src',
        'app',
        '[locale]',
        '(main)',
        join('(plugins)', `(${pluginPathName})`),
      );

      const adminDest = join(
        baseDir,
        'src',
        'app',
        '[locale]',
        'admin',
        '(auth)',
        join('(plugins)', `(${pluginPathName})`),
      );

      const langDest = join(baseDir, 'src', 'locales', pluginName);

      // Define source configurations for this plugin
      const sources: SourceConfig[] = [
        {
          sourceDir: join(pluginPath, 'src', 'app_admin'),
          destinationDir: adminDest,
        },
        {
          sourceDir: join(pluginPath, 'src', 'app'),
          destinationDir: mainDest,
        },
        {
          sourceDir: join(pluginPath, 'src', 'locales'),
          destinationDir: langDest,
        },
      ];

      // Copy files for each source directory
      for (const { sourceDir, destinationDir } of sources) {
        if (existsSync(sourceDir) && !isDirectoryEmpty(sourceDir)) {
          console.log(
            `\x1b[36mCopying ${pluginName}:\x1b[0m ${relative(repoRoot, sourceDir)} → ${relative(repoRoot, destinationDir)}`,
          );
          copyDirectoryRecursive(
            sourceDir,
            destinationDir,
            packageName,
            routeMap,
            localeRoot,
            repoRoot,
            false, // verbose = false for prepare mode
          );
        }
      }
    }),
  );
};
