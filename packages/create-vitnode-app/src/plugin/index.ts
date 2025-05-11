import { input } from '@inquirer/prompts';
import { basename, resolve } from 'path';

import { validateNpmName } from '../helpers/validate-pkg.js';

export const createPlugin = async (projectPath: string) => {
  let name = projectPath;
  if (!name) {
    name = await input({
      message: 'What is your plugin named?',
      default: 'my-vitnode-plugin',
      validate: (name: string) => {
        const validation = validateNpmName({ name: basename(resolve(name)) });
        if (validation.valid) return true;

        return `Invalid plugin name: ${validation.problems[0]}`;
      },
    });
  }
};
