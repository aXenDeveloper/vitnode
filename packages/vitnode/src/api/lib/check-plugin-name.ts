import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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

export const checkPluginName = (pluginName: string): PackageJSON => {
  const path = join(process.cwd(), 'node_modules', pluginName, 'package.json');

  if (
    !existsSync(path) &&
    pluginName !== 'vitnode' &&
    CONFIG.node_development
  ) {
    throw new Error(
      `package.json file not found at ${path}. If you are the developer of this plugin, please ensure you are using the correct plugin name as specified in its package.json.`,
    );
  }

  const content: PackageJSON = JSON.parse(readFileSync(path, 'utf-8'));

  if (CONFIG.node_development && content.name !== pluginName) {
    throw new Error(
      `The plugin name in package.json (${content.name}) does not match the requested plugin name (${pluginName}). Please check the plugin name.`,
    );
  }

  return content;
};
