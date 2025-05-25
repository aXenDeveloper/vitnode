/* eslint-disable no-console */
import { join } from 'path';
import { pathToFileURL } from 'url';

import type { VitNodeConfig } from '../src/vitnode.config';

export const getConfig = async (): Promise<VitNodeConfig> => {
  const configPath = join(process.cwd(), 'src', 'vitnode.config.ts');
  try {
    const configUrl = pathToFileURL(configPath).href;
    const loaded = await import(configUrl);
    const config = loaded.vitNodeConfig;

    return config;
  } catch (error) {
    console.error('Failed to load config:', error);
    process.exit(1);
  }
};
