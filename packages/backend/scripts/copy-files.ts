/* eslint-disable no-console */

import { existsSync } from 'fs';
import { cp, mkdir, rm } from 'fs/promises';
import { join } from 'path';

export const copyFiles = async ({ pluginsPath }: { pluginsPath: string }) => {
  const currentPathToCoreAdmin = join(pluginsPath, 'core', 'admin', 'database');

  // Check if the directory exists before trying to remove files
  if (existsSync(currentPathToCoreAdmin)) {
    const indexFilePath = join(currentPathToCoreAdmin, 'index.ts');
    const schemaPath = join(currentPathToCoreAdmin, 'schema');

    // Remove the index.ts file if it exists
    if (existsSync(indexFilePath)) {
      await rm(indexFilePath, { recursive: true });
    }

    // Remove the schema directory if it exists
    if (existsSync(schemaPath)) {
      await rm(schemaPath, { recursive: true });
    }
  }

  // Create the directory if it doesn't exist
  await mkdir(currentPathToCoreAdmin, { recursive: true });

  // Copy core plugin
  const currentPathToSchema = join(__dirname, '..', '..', 'src', 'database');

  // Check if the source directory exists before copying
  if (!existsSync(currentPathToSchema)) {
    console.log(
      `⛔️ Plugins not found in 'src/plugins' directory. "${currentPathToSchema}"`,
    );
    process.exit(1);
  }

  // Copy the schema directory to the core admin path
  await cp(currentPathToSchema, currentPathToCoreAdmin, { recursive: true });
};
