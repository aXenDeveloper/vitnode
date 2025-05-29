import type { Config } from 'drizzle-kit';

import { defineConfig } from 'drizzle-kit';
import { join } from 'path';

import type { VitNodeApiConfig } from './vitnode.config';

export const defineVitNodeDrizzleConfig = ({
  vitNodeApiConfig,
  ...args
}: Config & {
  vitNodeApiConfig: VitNodeApiConfig;
}) => {
  const pluginNames = vitNodeApiConfig.plugins.map(plugin => plugin.name);

  const pluginPaths = ['@vitnode/core', ...pluginNames].map(pluginName => {
    const pluginPath = join(
      process.cwd(),
      'node_modules',
      pluginName,
      'src',
      'database',
    );

    return pluginPath;
  });

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
