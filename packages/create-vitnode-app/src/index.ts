#!/usr/bin/env node
import { input } from '@inquirer/prompts';
import { Command, Option } from 'commander';
import { basename, resolve } from 'path';
import color from 'picocolors';

import { createVitNode } from './create/create-vitnode.js';
import { packageJson } from './helpers/get-package-json.js';
import { validateNpmName } from './helpers/validate-pkg.js';
import { createQuestionsCli } from './questions.js';
import { validationProject } from './validation.js';

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.error(
    color.red(
      `\nError: VitNode requires Node.js version 20 or higher.\nYou are currently using Node.js ${process.versions.node}\n`,
    ),
  );
  process.exit(1);
}

process.on('uncaughtException', (error: Error) => {
  if (error.name === 'ExitPromptError') {
    console.log(color.dim('👋 VitNode setup cancelled - see you next time!'));
    process.exit(0);
  }

  console.error(color.red('An unexpected error occurred:'));
  console.error(color.red(error.stack ?? error.message));
  process.exit(1);
});

const init = async () => {
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
    ).choices(['npm', 'pnpm', 'bun']),
  );
  program.option('--eslint', 'Initialize with eslint config.');
  program.option(
    '--skip-install',
    'Skip installing packages after initializing the project.',
  );

  if (!projectPath) {
    projectPath = await input({
      message: 'What is your project named?',
      default: 'my-vitnode',
      validate: (name: string) => {
        const validation = validateNpmName({ name: basename(resolve(name)) });
        if (validation.valid) return true;

        return `Invalid project name: ${validation.problems[0]}`;
      },
    });
  }

  const { appName, root } = await validationProject(projectPath);
  const options = await createQuestionsCli(program);
  await createVitNode({
    appName,
    root,
    ...options,
  });
};

await init();
