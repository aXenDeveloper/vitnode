import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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

export const getPluginPackageJson = (pluginName: string): PackageJSON => {
  const path = join(process.cwd(), 'node_modules', pluginName, 'package.json');

  if (!existsSync(path) && pluginName !== 'vitnode') {
    throw new Error(
      `package.json file not found at ${path}. If you are the developer of this plugin, please ensure you are using the correct plugin name as specified in its package.json. If you are not the author, please contact the plugin author for support.`,
    );
  }

  const content: PackageJSON = JSON.parse(readFileSync(path, 'utf-8'));

  return content;
};
