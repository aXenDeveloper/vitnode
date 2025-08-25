/** biome-ignore-all lint/suspicious/noConsole: <errors> */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { EnvironmentConfig } from "../environment.ts";
import {
  copyDirectoryExcludingPlugins,
  copyFile,
  validatePath,
} from "./file-system.ts";

export class FileCopyManager {
  constructor(private env: EnvironmentConfig) {}

  async init(): Promise<void> {
    const sourcePath = join(this.env.WORKSPACE, "apps", "docs");
    const destPath = join(
      this.env.WORKSPACE,
      "packages",
      "create-vitnode-app",
      "copy-of-vitnode-app",
      "root",
    );
    const singleAppApiDestPath = join(
      this.env.WORKSPACE,
      "packages",
      "create-vitnode-app",
      "copy-of-vitnode-app",
      "api-single-app",
    );

    if (!validatePath(sourcePath, "web app directory")) {
      throw new Error("Required paths not found");
    }

    await this.copyFiles(sourcePath, destPath, [
      "src/app/[locale]/(main)/[...rest]",
      "src/app/[locale]/(main)/not-found.tsx",
      "src/app/[locale]/admin",
      "src/app/favicon.ico",
      "src/app/global-error.tsx",
      "src/app/layout.tsx",
      "src/app/not-found.tsx",
      "postcss.config.mjs",
      ".prettierrc.mjs",
    ]);

    const apiSourcePath = join(this.env.WORKSPACE, "apps", "api");
    const apiDestPath = join(
      this.env.WORKSPACE,
      "packages",
      "create-vitnode-app",
      "copy-of-vitnode-app",
      "api",
    );

    await this.copyFiles(apiSourcePath, apiDestPath, [
      "tsconfig.json",
      "drizzle.config.ts",
    ]);

    await this.copyFiles(sourcePath, singleAppApiDestPath, [
      "src/app/api/[...route]",
      "drizzle.config.ts",
    ]);
  }

  copyFileOrDirectory(
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
      copyFile(from, to);
    }
  }

  copyFiles(sourcePath: string, destPath: string, filesToCopy: string[]) {
    // Handle special files with different names
    const specialFiles = [
      { source: ".gitignore", dest: ".gitignore_template" },
    ];

    for (const relativePath of filesToCopy) {
      this.copyFileOrDirectory(sourcePath, destPath, relativePath);
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
        copyFile(from, to);
      }
    }
  }
}
