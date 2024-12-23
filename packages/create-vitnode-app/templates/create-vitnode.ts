/* eslint-disable no-console */
import { join } from 'path';
import { randomBytes } from 'crypto';

import figlet from 'figlet';
import ora from 'ora';
import color from 'picocolors';

import { isFolderEmpty } from '../helpers/is-folder-empty';
import { CreateCliReturn } from '../cli';
import { createPackagesJSON } from '../helpers/create-packages-json';
import { installDependencies } from '../helpers/install-dependencies';
import { copyFile, cp, mkdir, readFile, rename, writeFile } from 'fs/promises';

export const createVitNode = async ({
  root,
  appName,
  packageManager,
  eslint,
  docker,
  install,
}: {
  appName: string;
  root: string;
} & CreateCliReturn) => {
  const useNpm = packageManager.startsWith('npm');
  const pm = packageManager.split('@')[0];
  const templatePath = join(__dirname, '..', 'templates');
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

  process.chdir(root);

  // Copy the basic template
  spinner.text = 'Copying files...';
  await cp(join(templatePath, 'basic'), root, { recursive: true });

  // Create package.json
  spinner.text = 'Creating package.json...';
  createPackagesJSON({
    appName,
    root,
    packageManager,
    docker,
    eslint,
  });

  // Rename files
  spinner.text = 'Renaming files...';
  await rename(join(root, '.gitignore_template'), join(root, '.gitignore'));

  // Change tailwind.config.ts based on package manager
  spinner.text = 'Changing tailwind.config.ts...';
  if (packageManager.startsWith('npm')) {
    const tailwindConfigPath = join(
      root,
      'apps',
      'frontend',
      'tailwind.config.ts',
    );
    const newTailwindConfig = (await readFile(tailwindConfigPath, 'utf-8'))
      .replace(
        './node_modules/vitnode-frontend/src/components/**/*.tsx',
        '../../node_modules/vitnode-frontend/src/components/**/*.tsx',
      )
      .replace(
        './node_modules/vitnode-frontend/src/views/**/*.tsx',
        '../../node_modules/vitnode-frontend/src/views/**/*.tsx',
      );

    await writeFile(tailwindConfigPath, newTailwindConfig);
  }
  if (docker) {
    spinner.text = 'Setup docker-compose-dev.yml...';
    const dockerComposeDevPath = join(root, 'docker-compose-dev.yml');
    const newDockerComposeDev = (await readFile(dockerComposeDevPath, 'utf-8'))
      .replace('vitnode_postgres_dev', `${appName}_postgres_dev`)
      .replace('vitnode_pgadmin_dev', `${appName}_pgadmin_dev`);

    await writeFile(dockerComposeDevPath, newDockerComposeDev);
  }

  // Copy pnpm template
  if (packageManager.startsWith('pnpm')) {
    spinner.text = 'Copying pnpm template...';
    await cp(join(templatePath, 'pnpm'), root, { recursive: true });
  }

  // Copy eslint template
  if (eslint) {
    spinner.text = 'Copying eslint template...';
    await cp(join(templatePath, 'eslint'), root, { recursive: true });
  }

  // Copy docker template
  if (docker) {
    spinner.text = 'Copying docker template...';
    await cp(join(templatePath, 'docker'), root, { recursive: true });
  }

  // Change the .env file
  spinner.text = 'Changing .env file...';
  await copyFile(join(root, '.env.template'), join(root, '.env'));
  const envPath = join(root, '.env');
  const newEnv = (await readFile(envPath, 'utf-8')).replace(
    'LOGIN_TOKEN_SECRET=vitnode_secret',
    `LOGIN_TOKEN_SECRET=${randomBytes(32).toString('hex')}`,
  );

  await writeFile(envPath, newEnv);

  // Install dependencies
  if (install) {
    spinner.text = 'Installing dependencies...';
    await installDependencies({ packageManager });
  }

  console.log(
    '\n' +
      color.blue(
        figlet.textSync('VitNode', {
          horizontalLayout: 'full',
        }),
      ),
    +'\n',
  );

  spinner.succeed(
    ` ${color.green('Success!')} Created ${color.cyan(appName)} at ${color.cyan(root)}`,
  );

  console.log('Inside that directory, you can run several commands:\n');
  console.log(color.cyan(`  ${pm} ${useNpm ? 'run ' : ''}dev`));
  console.log('    Starts the development servers.\n');
  console.log(color.cyan(`  ${pm} ${useNpm ? 'run ' : ''}config:init`));
  console.log('    Initializes the VitNode config & files to build project.\n');
  console.log(color.cyan(`  ${pm} ${useNpm ? 'run ' : ''}build`));
  console.log('    Builds the apps for production.\n');
  console.log(color.cyan(`  ${pm} start`));
  console.log('    Runs the built app in production mode.\n');
  console.log('We suggest that you begin by typing:\n');
  console.log(color.cyan('  cd'), appName);
  console.log(`  ${color.cyan(`${pm} ${useNpm ? 'run ' : ''}dev`)}\n`);
  console.log(color.magenta('Happy hacking!'));
};
