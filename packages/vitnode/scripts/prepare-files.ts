/* eslint-disable no-console */
import { existsSync } from 'fs';
import { cp, mkdir } from 'fs/promises';
import { join } from 'path';

const copyDatabase = async (pluginsPath: string) => {
  const databasePath = join(__dirname, '..', '..', 'src', 'database');
  if (!existsSync(databasePath)) {
    console.log(
      `⛔️ Database not found in 'src/database' directory. "${databasePath}"`,
    );
    process.exit(1);
  }
  const destinationPath = join(process.cwd(), 'src', 'database');
  if (!existsSync(destinationPath)) {
    await mkdir(destinationPath, { recursive: true });
  }

  // Copy files
  await cp(databasePath, destinationPath, {
    recursive: true,
    filter: src => !src.endsWith('client.ts'),
  });

  // Copy client.ts if it doesn't exist
  if (!existsSync(join(destinationPath, 'client.ts'))) {
    await cp(
      join(databasePath, 'client.ts'),
      join(destinationPath, 'client.ts'),
    );
  }
};

export const prepareFiles = async ({
  pluginsPath,
  initMessage,
}: {
  initMessage: string;
  pluginsPath: string;
}) => {
  console.log(`${initMessage} [1/1] Preparing files...`);
  await copyDatabase(pluginsPath);
  console.log(`${initMessage} \x1b[32mFiles prepared successfully.\x1b[0m`);
  process.exit(0);
};
