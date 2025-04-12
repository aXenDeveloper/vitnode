import { mkdir } from 'fs/promises';
import ora from 'ora';
import color from 'picocolors';

import { isFolderEmpty } from '../helpers/is-folder-empty.js';
import { CreateCliReturn } from '../questions.js';

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

  /**
   * Create the folder
   */
  await mkdir(root, { recursive: true });
  if (!isFolderEmpty(root, appName)) {
    process.exit(1);
  }

  spinner.succeed(
    ` ${color.green('Success!')} Created ${color.cyan(appName)} at ${color.cyan(root)}`,
  );
};
