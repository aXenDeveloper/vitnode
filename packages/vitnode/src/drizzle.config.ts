import type { Config } from 'drizzle-kit';

import { defineConfig } from 'drizzle-kit';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

import type { VitNodeApiConfig } from './vitnode.config';

export const defineVitNodeDrizzleConfig = ({
  vitNodeApiConfig,
  ...args
}: Config & {
  vitNodeApiConfig: VitNodeApiConfig;
}) => {
  const pluginId = vitNodeApiConfig.plugins.map(plugin => plugin.pluginId);

  const pluginPaths = ['@vitnode/core', ...pluginId]
    .map(itemId => {
      const pluginPath = resolve(
        process.cwd(),
        'node_modules',
        itemId,
        'dist',
        'src',
        'database',
      );

      // Check if the plugin path exists
      if (!existsSync(pluginPath)) {
        return null;
      }

      // Check if there are any .ts files in the directory
      try {
        const files = readdirSync(pluginPath);
        const hasSchemaFiles = files.some(file => file.endsWith('.js'));
        if (!hasSchemaFiles) return null;

        // Return glob pattern for schema files
        return join(pluginPath, '*.js').replace(/\\/g, '/');
      } catch {
        return null;
      }
    })
    .filter(pluginPath => pluginPath !== null);

  return defineConfig({
    ...args,
    schema: [
      ...(Array.isArray(args.schema)
        ? args.schema
        : args.schema
          ? [args.schema]
          : []),
      ...pluginPaths,
    ],
  });
};
