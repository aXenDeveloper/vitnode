import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

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
