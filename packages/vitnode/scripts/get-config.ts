/* eslint-disable no-console */
import { join } from 'path';
import { pathToFileURL } from 'url';

export const getConfig = async () => {
  const configPath = join(process.cwd(), 'src', 'vitnode.config.ts');
  try {
    const configUrl = pathToFileURL(configPath).href;
    const loaded = await import(configUrl);

    const config = loaded.vitNodeConfig ?? loaded.default;
    console.log('Config metadata title:', config.metadata.title);
  } catch (error) {
    console.error('Failed to load config:', error);
    process.exit(1);
  }
};
