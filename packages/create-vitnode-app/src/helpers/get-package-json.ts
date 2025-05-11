import { readFile } from 'fs/promises';

import type { PackageJSON } from './packages-json.js';

export const packageJson: PackageJSON = JSON.parse(
  await readFile(new URL('../../package.json', import.meta.url), 'utf-8'),
);
