import { Command } from 'commander';
import color from 'picocolors';
import prompts from 'prompts';

import { onPromptState } from './helpers/cli.js';
import {
  getAvailablePackageManagers,
  PackageManager,
} from './helpers/get-available-package-managers.js';

export interface CreateCliReturn {
  eslint: boolean;
  install: boolean;
  packageManager: string;
}

export const createCli = async (program: Command): Promise<CreateCliReturn> => {
  const optionsFromProgram = program.opts();
  let options: CreateCliReturn = {
    packageManager: optionsFromProgram.packageManager,
    eslint: optionsFromProgram.eslint,
    install: !optionsFromProgram.skipInstall,
  };

  if (!optionsFromProgram.packageManager) {
    const availablePackageManagers = await getAvailablePackageManagers();
    const { packageManager } = await prompts({
      onState: onPromptState,
      name: 'packageManager',
      type: 'select',
      message: `Which ${color.blue('package manager')} do you want to use?`,
      initial: optionsFromProgram.packageManager,
      choices: [
        {
          title: `npm${availablePackageManagers.npm ? `@${availablePackageManagers.npm}` : ''}`,
          value: 'npm',
          disabled: !availablePackageManagers.npm,
        },
        {
          title: `pnpm${availablePackageManagers.pnpm ? `@${availablePackageManagers.pnpm}` : ''}`,
          value: 'pnpm',
          disabled: !availablePackageManagers.pnpm,
        },
        {
          title: `bun${availablePackageManagers.bun ? `@${availablePackageManagers.bun}` : ''}`,
          value: 'bun',
          disabled: !availablePackageManagers.bun,
        },
      ],
    });

    options = {
      ...options,
      packageManager: `${packageManager}@${availablePackageManagers[packageManager as PackageManager]}`,
    };
  }

  if (optionsFromProgram.eslint === undefined) {
    const { eslint } = await prompts({
      onState: onPromptState,
      type: 'toggle',
      name: 'eslint',
      message: `Would you like to use ${color.blue('ESLint')}?`,
      initial: optionsFromProgram.eslint ? 'Yes' : 'No',
      active: 'Yes',
      inactive: 'No',
    });

    options = {
      ...options,
      eslint: !!eslint,
    };
  }

  if (optionsFromProgram.skipInstall === undefined) {
    const { install } = await prompts({
      onState: onPromptState,
      type: 'toggle',
      name: 'install',
      message: `Would you like to ${color.blue('Install dependencies')}?`,
      initial: optionsFromProgram.eslint ? 'Yes' : 'No',
      active: 'Yes',
      inactive: 'No',
    });

    options = {
      ...options,
      install: !!install,
    };
  }

  return options;
};
