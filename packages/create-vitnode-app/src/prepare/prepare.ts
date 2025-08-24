/** biome-ignore-all lint/suspicious/noConsole: <no need> */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const prepare = async () => {
  const toRootPath = join(process.cwd(), 'copy-of-vitnode-app');
  if (!existsSync(toRootPath)) {
    await mkdir(toRootPath);
  }
  const fromRootPath = join(process.cwd(), '..', '..', 'apps', 'docs');
  if (!existsSync(fromRootPath)) {
    console.error(
      `\x1b[31mThe path ${fromRootPath} does not exist. Please check the directory structure.\x1b[0m`,
    );
    process.exit(1);
  }

  console.log(`Project path: ${fromRootPath}`);
};

void prepare();
