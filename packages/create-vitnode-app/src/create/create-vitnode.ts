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
  docker,
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
    docker,
  });

  if (docker) {
    spinner.text = 'Copying docker files...';
    await copyFile(
      join(templatePath, 'docker', 'docker-compose.yml'),
      join(root, 'docker-compose.yml'),
    );

    // Update docker-compose.yml with app name
    const dockerComposePath = join(root, 'docker-compose.yml');
    const dockerComposeContent = await readFile(dockerComposePath, 'utf-8');
    const updatedContent = dockerComposeContent.replace(
      /vitnode_postgres_dev/g,
      `${appName}_vitnode_postgres_dev`,
    );
    await writeFile(dockerComposePath, updatedContent);
  }

  if (install) {
    spinner.text = 'Installing dependencies...';
    await installDependencies({
      packageManager,
      cwd: root,
    });
  }

  spinner.succeed(
    `${color.green('Success!')} Created ${color.cyan(appName)} at ${color.cyan(root)}`,
  );
};
