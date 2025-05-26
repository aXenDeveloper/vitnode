import { existsSync } from 'fs';
import { cp, mkdir } from 'fs/promises';
import ora from 'ora';
import { dirname, join } from 'path';
import color from 'picocolors';
import { fileURLToPath } from 'url';

import type { CreateCliReturn } from '../questions.js';

import { isFolderEmpty } from '../helpers/is-folder-empty.js';

export const createVitNode = async ({
  root,
  appName,
  packageManager,
}: CreateCliReturn & {
  appName: string;
  root: string;
}) => {
  const spinner = ora(
    `Creating a new VitNode app in ${color.green(root)}. Using ${color.green(packageManager)}...`,
  ).start();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const templatePath = join(__dirname, '..', '..', '..', 'copy-of-vitnode-app');
  if (!existsSync(templatePath)) {
    spinner.fail(
      `\n${color.red('Error!')} Template path ${color.cyan(templatePath)} does not exist.`,
    );
    process.exit(1);
  }

  // Create the folder
  await mkdir(root, { recursive: true });
  if (!isFolderEmpty(root, appName)) {
    process.exit(1);
  }

  // Copy the template files
  spinner.text = 'Copying files...';
  await cp(join(templatePath, 'root'), root, {
    recursive: true,
  });

  spinner.succeed(
    `${color.green('Success!')} Created ${color.cyan(appName)} at ${color.cyan(root)}`,
  );
};
