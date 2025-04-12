import { exec } from 'child_process';

export type PackageManager = 'bun' | 'npm' | 'pnpm';

export const execShellCommand = async (
  cmd: string,
): Promise<string | undefined> => {
  return new Promise(resolve => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        resolve(undefined);
      }
      const result = stdout ? stdout : stderr;

      resolve(result.replace(/\s+/g, ''));
    });
  });
};

export const getAvailablePackageManagers = async (): Promise<
  Record<PackageManager, string | undefined>
> => {
  const [npm, pnpm, bun] = await Promise.all([
    execShellCommand('npm --version'),
    execShellCommand('pnpm --version'),
    execShellCommand('bun --version'),
  ]);

  return {
    pnpm,
    npm,
    bun,
  };
};
