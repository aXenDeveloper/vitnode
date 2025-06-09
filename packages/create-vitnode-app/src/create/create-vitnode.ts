import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { copyFile, cp, mkdir, readFile, rename, writeFile } from 'fs/promises';
import ora from 'ora';
import { dirname, join } from 'path';
import color from 'picocolors';
import { fileURLToPath } from 'url';

import type { CreateCliReturn } from '../questions.js';

import { installDependencies } from '../helpers/install-dependencies.js';
import { isFolderEmpty } from '../helpers/is-folder-empty.js';
import { createPackageJSON } from './create-package-json.js';

export const createVitNode = async ({
  root,
  appName,
  packageManager,
  eslint,
  install,
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

  spinner.text = 'Copying files...';
  await cp(join(templatePath, 'root'), root, {
    recursive: true,
  });

  if (eslint) {
    spinner.text = 'Copying eslint files...';
    await cp(join(templatePath, 'eslint'), root, {
      recursive: true,
    });
  }

  // Rename special files
  spinner.text = 'Renaming special files...';
  await rename(join(root, '.gitignore_template'), join(root, '.gitignore'));

  spinner.text = 'Creating package.json...';
  await createPackageJSON({
    root,
    appName,
    packageManager,
    eslint,
  });

  spinner.text = 'Changing .env file...';
  await copyFile(join(root, '.env.example'), join(root, '.env'));
  const envPath = join(root, '.env');
  const newEnv = (await readFile(envPath, 'utf-8')).replace(
    'LOGIN_TOKEN_SECRET=vitnode_secret',
    `LOGIN_TOKEN_SECRET=${randomBytes(32).toString('hex')}`,
  );
  await writeFile(envPath, newEnv);

  if (install) {
    spinner.text = 'Installing dependencies...';
    await installDependencies({
      packageManager,
    });
  }

  spinner.succeed(
    `${color.green('Success!')} Created ${color.cyan(appName)} at ${color.cyan(root)}`,
  );
};
