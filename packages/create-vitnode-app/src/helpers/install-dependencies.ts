import { spawn } from 'child_process';
import color from 'picocolors';

import type { CreateCliReturn } from '../questions.js';

import { getOnline } from './is-online.js';

export const installDependencies = async ({
  packageManager: pm,
}: Pick<CreateCliReturn, 'packageManager'>) => {
  const packageManager = pm.split('@')[0];
  const isOnline = await getOnline();
  const args: string[] =
    packageManager === 'npm' ? ['install', '--force'] : ['install'];

  if (!isOnline) {
    console.log(
      color.yellow(
        'You appear to be offline.\nFalling back to the local cache.',
      ),
    );
    args.push('--offline');
  }

  /**
   * Return a Promise that resolves once the installation is finished.
   */
  return new Promise<void>((resolve, reject) => {
    /**
     * Spawn the installation process.
     */
    const child = spawn(packageManager, args, {
      stdio: 'ignore', // Change 'inherit' to 'ignore'
      env: {
        ...process.env,
        ADBLOCK: '1',
        // we set NODE_ENV to development as pnpm skips dev
        // dependencies when production
        NODE_ENV: 'development',
        DISABLE_OPENCOLLECTIVE: '1',
      },
    });
    child.on('close', code => {
      if (code !== 0) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject({ command: `${packageManager} ${args.join(' ')}` });

        return;
      }

      resolve();
    });
  });
};
