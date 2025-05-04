import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const getPackageJson = async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const packageJSONPath = join(__dirname, '../../../../package.json');

  if (!existsSync(packageJSONPath)) {
    throw new Error(`package.json not found in ${packageJSONPath}`);
  }

  const packageJSON: { version: string } = JSON.parse(
    await readFile(packageJSONPath, 'utf8'),
  );

  return packageJSON;
};
