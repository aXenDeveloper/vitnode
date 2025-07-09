import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';

export class FileSystem {
  static copyFile(from: string, to: string): void {
    try {
      const destinationDir = dirname(to);
      if (!existsSync(destinationDir)) {
        mkdirSync(destinationDir, { recursive: true });
      }
      copyFileSync(from, to);
    } catch (error) {
      throw new Error(
        `Failed to copy file: ${from} → ${to}: ${(error as Error).message}`,
      );
    }
  }

  static copyDirectoryExcludingPlugins(from: string, to: string): void {
    try {
      if (!existsSync(to)) {
        mkdirSync(to, { recursive: true });
      }

      for (const item of readdirSync(from)) {
        if (item === '(plugins)' || item === '.env') continue;

        const sourcePath = join(from, item);
        const destinationPath = join(to, item);
        const stats = statSync(sourcePath);

        if (stats.isDirectory()) {
          this.copyDirectoryExcludingPlugins(sourcePath, destinationPath);
        } else {
          copyFileSync(sourcePath, destinationPath);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to copy directory: ${from} → ${to}: ${(error as Error).message}`,
      );
    }
  }

  static validatePath(filePath: string, description: string): boolean {
    if (existsSync(filePath)) return true;

    console.error(`✖ Missing ${description}: ${filePath}`);
    return false;
  }
}
