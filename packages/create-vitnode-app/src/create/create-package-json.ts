import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type { PackageJSON } from '../helpers/packages-json.js';

import { getAvailablePackageManagers } from '../helpers/get-available-package-managers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const createPackageJSON = async ({
  appName,
  packageManager,
  root,
  eslint,
  docker,
}: {
  appName: string;
  docker?: boolean;
  eslint: boolean;
  packageManager: string;
  root: string;
}) => {
  const availablePackageManagers = await getAvailablePackageManagers();
  const pkg: PackageJSON = JSON.parse(
    await readFile(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'),
  );

  const packageJson: PackageJSON = {
    name: appName,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      'db:push': 'vitnode push',
      'db:migrate': 'vitnode migrate',
      dev: 'vitnode init && next dev --turbopack',
      build: 'next build --turbopack',
      start: 'next start',
      ...(eslint
        ? {
            lint: 'eslint .',
            'lint:fix': 'eslint . --fix',
          }
        : {}),
      ...(docker
        ? {
            'docker:dev': `docker compose -f ./docker-compose.yml -p ${appName}-vitnode-dev up -d`,
          }
        : {}),
      'drizzle-kit': 'drizzle-kit',
    },
    dependencies: {
      '@hono/zod-openapi': '^0.19.8',
      '@hono/zod-validator': '^0.7.0',
      '@hookform/resolvers': '^5.1.1',
      '@react-email/components': '^0.1.1',
      '@vitnode/core': `^${pkg.version}`,
      'babel-plugin-react-compiler': '19.1.0-rc.2',
      'drizzle-kit': '^0.31.3',
      'drizzle-orm': '^0.44.2',
      hono: '^4.8.3',
      'lucide-react': '^0.523.0',
      next: '^15.3.4',
      'next-intl': '^4.3.1',
      react: '^19.1.0',
      'react-dom': '^19.1.0',
      'react-hook-form': '^7.58.1',
      sonner: '^2.0.5',
      zod: '^3.25.67',
    },
    devDependencies: {
      '@tailwindcss/postcss': '^4.1.11',
      '@types/node': '^24',
      '@types/react': '^19.1',
      '@types/react-dom': '^19.1',
      ...(eslint
        ? {
            eslint: '^9.29.0',
            '@vitnode/eslint-config': `^${pkg.version}`,
            'prettier-plugin-tailwindcss': '^0.6.12',
            prettier: '^3.6.1',
          }
        : {}),
      'react-email': '^4.0.17',
      tailwindcss: '^4.1.11',
      'tw-animate-css': '^1.3.2',
      typescript: '^5.8.3',
    },
    packageManager: `${packageManager}@${availablePackageManagers[packageManager]}`,
  };

  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  );
};
