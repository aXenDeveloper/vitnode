import { spawn } from 'child_process';

import type { CreateCliReturn } from '../questions.js';

export const initFilesVitnode = ({
  packageManager: pm,
  cwd,
}: Pick<CreateCliReturn, 'packageManager'> & { cwd?: string }) => {
  const packageManager = pm.split('@')[0];
  const args: string[] = ['vitnode', 'prepare-plugins'];

  spawn(packageManager, args, {
    cwd,
  });
};

export const generateMigrationsVitnode = ({
  packageManager: pm,
  cwd,
}: Pick<CreateCliReturn, 'packageManager'> & { cwd?: string }) => {
  const packageManager = pm.split('@')[0];
  const args: string[] = ['vitnode', 'migrate', '--generate'];

  spawn(packageManager, args, {
    cwd,
  });
};
