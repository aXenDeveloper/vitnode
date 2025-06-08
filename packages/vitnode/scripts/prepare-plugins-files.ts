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
  const config = await getConfig();
  const plugins: string[] = [
    ...config.plugins.map(plugin => plugin.pluginId),
    'vitnode',
  ];

  const repoRoot = findRepoRoot(process.cwd());
  const localeRoot = findLocaleRoot(repoRoot);
  const routeMap = buildInitialRouteMap(localeRoot);

  await Promise.all(
    plugins.map(async pluginName => {
      const pluginPath = join(process.cwd(), 'node_modules', pluginName);

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
      const langDest = join(
        repoRoot,
        'apps',
        'web',
        'src',
        'locales',
        pluginName,
      );

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
