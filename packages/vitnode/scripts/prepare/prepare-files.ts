/* eslint-disable no-console */

import { preparePlugins } from './prepare-plugins';

export const prepareFiles = async ({
  initMessage,
}: {
  initMessage: string;
}) => {
  console.log(`${initMessage} Preparing files...`);
  await preparePlugins();
  console.log(`${initMessage} \x1b[32mFiles prepared successfully.\x1b[0m`);
  process.exit(0);
};
