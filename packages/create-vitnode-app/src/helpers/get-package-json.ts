import { readFileSync } from 'fs';

import type { PackageJSON } from './packages-json.js';

export const packageJson: PackageJSON = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8'),
);
