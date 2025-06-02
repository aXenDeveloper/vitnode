import { join } from 'path';
import { FileSystem } from './file-system.ts';
import { existsSync, statSync } from 'fs';
import type { EnvironmentConfig } from '../environment.ts';

export class FileCopyManager {
  constructor(private env: EnvironmentConfig) {}

  async init(): Promise<void> {
    const sourcePath = join(this.env.WORKSPACE, 'apps', 'web');
    const destPath = join(
      this.env.WORKSPACE,
      'packages',
      'create-vitnode-app',
      'copy-of-vitnode-app',
      'root',
    );

    if (
      !FileSystem.validatePath(sourcePath, 'web app directory') ||
      !FileSystem.validatePath(destPath, 'copy-of-vitnode-app directory')
    ) {
      throw new Error('Required paths not found');
    }

    await this.copyFiles(sourcePath, destPath);
  }

  async copyFileOrDirectory(
    sourcePath: string,
    destPath: string,
    relativePath: string,
  ): Promise<void> {
    const from = join(sourcePath, relativePath);
    const to = join(destPath, relativePath);

    const stats = existsSync(from) ? statSync(from) : null;
    if (!stats) {
      console.warn(`⚠ Source does not exist: ${from}`);
      return;
    }

    if (stats.isDirectory()) {
      FileSystem.copyDirectoryExcludingPlugins(from, to);
    } else {
      FileSystem.copyFile(from, to);
    }
  }

  async copyFiles(sourcePath: string, destPath: string): Promise<void> {
    // Define files and directories to copy (relative paths)
    const filesToCopy = [
      'src/app/[locale]',
      'src/app/favicon.ico',
      'src/app/global-error.tsx',
      'src/app/global.css',
      'src/app/layout.tsx',
      'src/app/not-found.tsx',
      'src/app/api',
      'tsconfig.json',
      'postcss.config.mjs',
      '.gitignore',
      'drizzle.config.ts',
      '.prettierrc.mjs',
      '.gitignore',
    ];

    for (const relativePath of filesToCopy) {
      await this.copyFileOrDirectory(sourcePath, destPath, relativePath);
    }
  }
}
