#!/usr/bin/env node
/* eslint-disable no-console */

import * as fs from 'fs';
import { join } from 'path';

const init = ({ dev }: { dev: boolean }) => {
  const initConsole = '\x1b[34m[VitNode]\x1b[0m \x1b[33m[Frontend]\x1b[0m';

  // Delete cache folder
  const cachePath = join(process.cwd(), '.next', 'cache');
  if (fs.existsSync(cachePath)) {
    console.log(`${initConsole} Deleting cache folder...`);
    fs.rmSync(cachePath, { recursive: true });
  }

  if (dev) {
    console.log(`${initConsole} ✅ Development environment is ready.`);
    process.exit(0);
  }

  const packagePath = join(__dirname, '..', '..', 'folders_to_copy');
  if (!fs.existsSync(packagePath)) {
    console.log(
      `${initConsole} ⛔️ The frontend package cannot find "folders_to_copy" folder. Please report this issue to the VitNode GitHub.`,
    );
    process.exit(1);
  }

  // Stage 1 - Force files to copy
  const forcePathFiles: {
    file: string;
    path: string;
  }[] = [
    {
      path: join('src', 'plugins', 'core', 'langs'),
      file: 'en.json',
    },
    {
      path: join('src', 'plugins', 'admin', 'langs'),
      file: 'en.json',
    },
  ];

  forcePathFiles.forEach(file => {
    const packageFromCopyPath = join(packagePath, file.path, file.file);
    const rootToCopyPath = join(process.cwd(), file.path, file.file);

    fs.copyFileSync(packageFromCopyPath, rootToCopyPath);
  });

  console.log(`${initConsole} ✅ Frontend files copied successfully.`);
  process.exit(0);
};

if (process.argv[2] === 'init') {
  init({ dev: false });
} else if (process.argv[2] === 'dev') {
  init({ dev: true });
}
