#!/usr/bin/env node
/* eslint-disable no-console */
import { Command, Option } from 'commander';
import figlet from 'figlet';
import { existsSync } from 'fs';
// Ref: https://github.com/vercel/next.js/blob/canary/packages/create-next-app/index.ts
import { basename, dirname, resolve } from 'path';
import color from 'picocolors';
import prompts from 'prompts';

import { createCli, onPromptState } from './cli';
import { isFolderEmpty } from './helpers/is-folder-empty';
import { isWriteable } from './helpers/is-writeable';
import { validateNpmName } from './helpers/validate-pkg';
import packageJson from './package.json' assert { type: 'json' };
import { createVitNode } from './templates/create-vitnode';

let projectPath = '';

const program = new Command()
  .version(packageJson.version)
  .argument('[project-directory]')
  .usage(`${color.green('[project-directory]')} [options]`)
  .action(name => {
    projectPath = name;
  });

program.addOption(
  new Option(
    '--package-manager <package-manager>',
    'Specify the package manager to use',
  ).choices(['npm', 'pnpm']),
);
program.option('--eslint', 'Initialize with eslint config.');
program.option('--docker', 'Initialize with Dockerfile & Docker Compose.');
program.option('--no-eslint', 'Initialize without eslint config.');
program.option(
  '--skip-install',
  'Skip installing packages after initializing the project.',
);

program.parse(process.argv);

void (async () => {
  console.log(
    color.blue(
      figlet.textSync('VitNode', {
        horizontalLayout: 'full',
      }),
    ),
  );

  if (!projectPath) {
    const response = await prompts({
      onState: onPromptState,
      type: 'text',
      name: 'path',
      message: 'What is your project named?',
      initial: 'my-vitnode',
      validate: (name: string) => {
        const validation = validateNpmName({ name: basename(resolve(name)) });
        if (validation.valid) return true;

        return `Invalid project name: ${validation.problems[0]}`;
      },
    });

    if (typeof response.path === 'string') {
      projectPath = response.path.trim();
    }
  }

  /**
   * Verify the project path is provided
   */
  if (!projectPath) {
    console.log(
      '\nPlease specify the project directory:\n' +
        `  ${color.cyan(program.name())} ${color.green('<project-directory>')}\n` +
        'For example:\n' +
        `  ${color.cyan(program.name())} ${color.green('my-vitnode-app')}\n\n` +
        `Run ${color.cyan(`${program.name()} --help`)} to see all options.`,
    );
    process.exit(1);
  }

  /**
   * Verify the project name is valid
   */
  const resolvedProjectPath = resolve(projectPath);
  const projectName = basename(resolvedProjectPath);
  const validation = validateNpmName({ name: projectName });
  if (!validation.valid) {
    console.error(
      `Could not create a project called ${color.red(
        `"${projectName}"`,
      )} because of npm naming restrictions:`,
    );

    validation.problems.forEach(p => {
      console.error(`${color.red(color.bold('*'))} ${p}`);
    });
    process.exit(1);
  }

  /**
   * Verify the project dir is empty or doesn't exist
   */
  const root = resolve(resolvedProjectPath);
  const appName = basename(root);
  const folderExists = existsSync(root);

  if (folderExists && !isFolderEmpty(root, appName)) {
    console.error('The specified directory is not empty.');
    process.exit(1);
  }

  /**
   * Verify the project dir is writeable
   */
  if (!(await isWriteable(dirname(root)))) {
    console.error(
      'The application path is not writable, please check folder permissions and try again.',
    );
    console.error(
      'It is likely you do not have write permissions for this folder.',
    );
    process.exit(1);
  }

  /**
   * Create the CLI
   */
  const choses = await createCli(program);

  /**
   * Create the project
   */
  await createVitNode({
    root,
    appName,
    ...choses,
  });
})();
