#!/usr/bin/env node
/* eslint-disable no-console */
import { existsSync } from 'fs';
import { join } from 'path';

import { processPlugin } from './plugin.js';
import { prepareDatabase } from './prepare-database.js';
import { prepareFiles } from './prepare/prepare-files.js';

const initMessage = '\x1b[34m[VitNode]\x1b[0m';
const getPluginsPath = () => {
  const pluginsPath = join(process.cwd(), 'src', 'plugins');
  if (!existsSync(pluginsPath)) {
    console.log(
      `⛔️ Plugins not found in 'src/plugins' directory. "${pluginsPath}"`,
    );
    process.exit(1);
  }

  return pluginsPath;
};

const command = process.argv[2];
const flag = process.argv[3];

switch (command) {
  case 'init':
    void prepareDatabase({ initMessage });
    break;

  case 'plugin':
    if (flag === '--w' || flag === '--watch') {
      processPlugin({ initMessage });
    }
    break;

  case 'prepare':
    void prepareFiles({ pluginsPath: getPluginsPath(), initMessage });
    break;

  default:
    console.log(
      `${initMessage} \x1b[31mCommand not found: "${command ?? ''}"\x1b[0m`,
    );
    process.exit(1);
}
