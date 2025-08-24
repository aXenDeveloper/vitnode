import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { CONFIG } from '../../lib/config';

export interface PackageJSON {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: Record<string, Record<string, string>>;
  name: string;
  overrides?: Record<string, string>;
  packageManager?: string;
  pnpm?: Record<string, Record<string, string>>;
  private: boolean;
  scripts?: Record<string, string>;
  version: string;
  workspaces?: string[];
}

export const checkPluginId = (pluginName: string): null | PackageJSON => {
  if (!CONFIG.node_development) return null;

  const findMonorepoRoot = (startPath: string): null | string => {
    let currentPath = startPath;
    while (currentPath !== resolve(currentPath, '..')) {
      const turboConfigPath = join(currentPath, 'turbo.json');

      if (existsSync(turboConfigPath)) {
        return currentPath;
      }
      currentPath = resolve(currentPath, '..');
    }

    return null;
  };

  const findPluginPath = (pluginName: string): null | string => {
    const cwd = process.cwd();
    const monorepoRoot = findMonorepoRoot(cwd);

    // Check in current working directory first
    const cwdPluginPath = join(cwd, 'node_modules', pluginName, 'package.json');
    if (existsSync(cwdPluginPath)) {
      return cwdPluginPath;
    }

    // Check in monorepo root if it exists and is different from cwd
    if (monorepoRoot && monorepoRoot !== cwd) {
      const rootPluginPath = join(
        monorepoRoot,
        'node_modules',
        pluginName,
        'package.json',
      );
      if (existsSync(rootPluginPath)) {
        return rootPluginPath;
      }
    }

    return null;
  };

  const path = findPluginPath(pluginName);

  if (!path) {
    throw new Error(
      `package.json file not found for plugin "${pluginName}". Please ensure you are using the correct plugin name as specified in its package.json.`,
    );
  }

  const content: PackageJSON = JSON.parse(readFileSync(path, 'utf-8'));
  if (content.name !== pluginName) {
    throw new Error(
      `The plugin name in package.json (${content.name}) does not match the requested plugin name (${pluginName}). Please check the plugin name.`,
    );
  }

  return content;
};
