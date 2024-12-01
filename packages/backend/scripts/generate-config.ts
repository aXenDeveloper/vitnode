import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import {
  ConfigType,
  DEFAULT_CONFIG_DATA,
  getConfigFile,
} from '../src/helpers/config';
import { updateObject } from './helpers/update-object';

export const generateConfig = async ({
  pluginsPath,
}: {
  pluginsPath: string;
}) => {
  const folderPath = join(pluginsPath, 'core', 'utils');
  if (!existsSync(folderPath)) {
    await mkdir(folderPath, { recursive: true });
  }

  const configPath = join(folderPath, 'config.json');
  if (!existsSync(configPath)) {
    await writeFile(
      configPath,
      JSON.stringify(DEFAULT_CONFIG_DATA, null, 2),
      'utf8',
    );

    return;
  }

  const config = getConfigFile();
  const updatedConfig: ConfigType = {
    ...updateObject(config, DEFAULT_CONFIG_DATA),
    last_updated: new Date().toISOString(),
  };

  await writeFile(
    configPath,
    JSON.stringify(
      { ...updatedConfig, restart_server: DEFAULT_CONFIG_DATA.restart_server },
      null,
      2,
    ),
    'utf8',
  );
};
