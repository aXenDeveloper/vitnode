import { spawn } from 'child_process';
import color from 'picocolors';

import type { CreateCliReturn } from '../questions.js';

import { getOnline } from './is-online.js';

export const installDependencies = async ({
  packageManager: pm,
  cwd,
}: Pick<CreateCliReturn, 'packageManager'> & { cwd?: string }) => {
  const packageManager = pm.split('@')[0];
  const isOnline = await getOnline();
  const args: string[] = ['install'];

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
    let stdout = '';
    let stderr = '';

    /**
     * Spawn the installation process.
     */
    const child = spawn(packageManager, args, {
      stdio: 'pipe', // Change to 'pipe' to capture output
      cwd, // Set the working directory
      env: {
        ...process.env,
        ADBLOCK: '1',
        // we set NODE_ENV to development as pnpm skips dev
        // dependencies when production
        NODE_ENV: 'development',
        DISABLE_OPENCOLLECTIVE: '1',
      },
    });

    // Capture stdout
    child.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;
    });

    // Capture stderr
    child.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      stderr += output;
      // Show error output in real-time
      console.error(color.red(output.trim()));
    });

    child.on('close', code => {
      if (code !== 0) {
        console.error(
          color.red(`\n❌ Installation failed with exit code: ${code}`),
        );

        if (stderr) {
          console.error(color.red('Error output:'));
          console.error(stderr);
        }

        if (stdout) {
          console.log(color.yellow('Standard output:'));
          console.log(stdout);
        }

        // Provide helpful suggestions based on common errors
        if (stderr.includes('ENOTFOUND') || stderr.includes('network')) {
          console.error(
            color.yellow(
              '💡 Network error detected. Please check your internet connection.',
            ),
          );
        } else if (
          stderr.includes('EACCES') ||
          stderr.includes('permission denied')
        ) {
          console.error(
            color.yellow(
              '💡 Permission error detected. Try running with elevated privileges or check file permissions.',
            ),
          );
        } else if (stderr.includes('ENOSPC')) {
          console.error(
            color.yellow(
              '💡 Disk space error detected. Please free up some disk space.',
            ),
          );
        } else if (stderr.includes('ERR_PNPM_PEER_DEP_ISSUES')) {
          console.error(
            color.yellow(
              '💡 Peer dependency issues detected. Consider using --force flag or resolve conflicts manually.',
            ),
          );
        }

        reject(
          new Error(
            `Failed to install dependencies using ${packageManager}. Exit code: ${code}\n${stderr || stdout}`,
          ),
        );

        return;
      }

      resolve();
    });

    // Handle process errors
    child.on('error', error => {
      console.error(
        color.red(`❌ Failed to start ${packageManager}:`),
        error.message,
      );
      reject(new Error(`Failed to start ${packageManager}: ${error.message}`));
    });
  });
};
