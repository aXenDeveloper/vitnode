import { join } from 'path';
import { FileSystem } from './file-system.ts';
import { existsSync, statSync } from 'fs';
import type { EnvironmentConfig } from '../environment.ts';

export class FileCopyManager {
  constructor(private env: EnvironmentConfig) {}

  async init(): Promise<void> {
    const sourcePath = join(this.env.WORKSPACE, 'apps', 'docs');
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
      'src/app/[locale]/(main)/[...rest]',
      'src/app/[locale]/(main)/not-found.tsx',
      'src/app/[locale]/admin',
      'src/app/favicon.ico',
      'src/app/global-error.tsx',
      'src/app/layout.tsx',
      'src/app/not-found.tsx',
      'src/app/api/[...route]',
      'tsconfig.json',
      'postcss.config.mjs',
      'drizzle.config.ts',
      '.prettierrc.mjs',
    ];

    // Handle special files with different names
    const specialFiles = [
      { source: '.gitignore', dest: '.gitignore_template' },
    ];

    for (const relativePath of filesToCopy) {
      await this.copyFileOrDirectory(sourcePath, destPath, relativePath);
    }

    // Handle special files with different destination names
    for (const { source, dest } of specialFiles) {
      const from = join(sourcePath, source);
      const to = join(destPath, dest);

      const stats = existsSync(from) ? statSync(from) : null;
      if (!stats) {
        console.warn(`⚠ Source does not exist: ${from}`);
        continue;
      }

      if (stats.isFile()) {
        FileSystem.copyFile(from, to);
      }
    }
  }
}
