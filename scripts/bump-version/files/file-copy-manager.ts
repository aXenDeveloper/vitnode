import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { EnvironmentConfig } from "../environment.ts";
import {
  copyDirectoryExcludingPlugins,
  copyFile,
  validatePath,
} from "./file-system.ts";

/**
 * Refreshes the parts of the `create-vitnode-app` templates that are copied
 * verbatim out of this repository at release time.
 *
 * Until Stage 17 this also seeded `copy-of-vitnode-app/root` and
 * `copy-of-vitnode-app/api-single-app` from `apps/docs`, whose Next.js App
 * Router tree (`src/app/[locale]/...`, `src/app/api/[...route]`) no longer
 * exists. Those template directories are now maintained in place rather than
 * generated; only the framework-neutral `apps/api` files are still mirrored.
 */
export class FileCopyManager {
  constructor(private env: EnvironmentConfig) {}

  async init(): Promise<void> {
    const apiSourcePath = join(this.env.WORKSPACE, "apps", "api");
    const apiDestPath = join(
      this.env.WORKSPACE,
      "packages",
      "create-vitnode-app",
      "copy-of-vitnode-app",
      "api",
    );

    if (!validatePath(apiSourcePath, "api app directory")) {
      throw new Error("Required paths not found");
    }

    await this.copyFiles(apiSourcePath, apiDestPath, [
      "tsconfig.json",
      "drizzle.config.ts",
    ]);
  }

  async copyFileOrDirectory(
    sourcePath: string,
    destPath: string,
    relativePath: string,
  ) {
    const from = join(sourcePath, relativePath);
    const to = join(destPath, relativePath);

    const stats = existsSync(from) ? statSync(from) : null;
    if (!stats) {
      console.warn(`⚠ Source does not exist: ${from}`);
      return;
    }

    if (stats.isDirectory()) {
      copyDirectoryExcludingPlugins(from, to);
    } else {
      await copyFile(from, to);
    }
  }

  async copyFiles(sourcePath: string, destPath: string, filesToCopy: string[]) {
    // Handle special files with different names
    const specialFiles = [
      { source: ".gitignore", dest: ".gitignore_template" },
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
        await copyFile(from, to);
      }
    }
  }
}
