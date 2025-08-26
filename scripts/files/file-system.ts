import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";

export function copyFile(from: string, to: string): void {
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

export function copyDirectoryExcludingPlugins(from: string, to: string): void {
  try {
    if (!existsSync(to)) {
      mkdirSync(to, { recursive: true });
    }

    for (const item of readdirSync(from)) {
      if (item === "(plugins)" || item === ".env") continue;

      const sourcePath = join(from, item);
      const destinationPath = join(to, item);
      const stats = statSync(sourcePath);

      if (stats.isDirectory()) {
        copyDirectoryExcludingPlugins(sourcePath, destinationPath);
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

export function validatePath(filePath: string, description: string): boolean {
  if (existsSync(filePath)) return true;

  throw new Error(`✖ Missing ${description}: ${filePath}`);
}
