import { select } from '@inquirer/prompts';
import { confirm } from '@inquirer/prompts';
import { Command } from 'commander';
import color from 'picocolors';

import { getAvailablePackageManagers } from './helpers/get-available-package-managers.js';

export interface CreateCliReturn {
  eslint: boolean;
  install: boolean;
  packageManager: string;
}

export const createQuestionsCli = async (
  program: Command,
): Promise<CreateCliReturn> => {
  const optionsFromProgram = program.opts();
  const options: CreateCliReturn = {
    packageManager: optionsFromProgram.packageManager,
    eslint: optionsFromProgram.eslint,
    install: !optionsFromProgram.skipInstall,
  };

  if (!optionsFromProgram.packageManager) {
    const availablePackageManagers = await getAvailablePackageManagers();
    options.packageManager = await select({
      message: `Which ${color.blue('package manager')} do you want to use?`,
      choices: [
        {
          name: `npm${availablePackageManagers.npm ? `@${availablePackageManagers.npm}` : ''}`,
          value: 'npm',
          disabled: !availablePackageManagers.npm,
        },
        {
          name: `pnpm${availablePackageManagers.pnpm ? `@${availablePackageManagers.pnpm}` : ''}`,
          value: 'pnpm',
          disabled: !availablePackageManagers.pnpm,
        },
        {
          name: `bun${availablePackageManagers.bun ? `@${availablePackageManagers.bun}` : ''}`,
          value: 'bun',
          disabled: !availablePackageManagers.bun,
        },
      ],
    });
  }

  if (optionsFromProgram.eslint === undefined) {
    options.eslint = await confirm({
      message: `Would you like to use ${color.blue('ESLint')}?`,
    });
  }

  if (optionsFromProgram.skipInstall === undefined) {
    options.install = await confirm({
      message: `Would you like to ${color.blue('Install dependencies')}?`,
    });
  }

  return options;
};
