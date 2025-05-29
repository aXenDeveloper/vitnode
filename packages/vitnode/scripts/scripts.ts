#!/usr/bin/env node
/* eslint-disable no-console */

import { processPlugin } from './plugin.js';
import { prepareDatabase } from './prepare-database.js';
import { prepareFiles } from './prepare/prepare-files.js';

const initMessage = '\x1b[34m[VitNode]\x1b[0m';

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
    void prepareFiles({ initMessage });
    break;

  default:
    console.log(
      `${initMessage} \x1b[31mCommand not found: "${command ?? ''}"\x1b[0m`,
    );
    process.exit(1);
}
