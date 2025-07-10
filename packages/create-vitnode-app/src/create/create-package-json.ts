import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type { PackageJSON } from '../helpers/packages-json.js';
import type { CreateCliReturn } from '../questions.js';

import { getAvailablePackageManagers } from '../helpers/get-available-package-managers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const createPackageJSON = async ({
  appName,
  packageManager,
  root,
  eslint,
  docker,
  mode,
}: {
  appName: string;
  docker?: boolean;
  eslint: boolean;
  mode: CreateCliReturn['mode'];
  packageManager: string;
  root: string;
}) => {
  const availablePackageManagers = await getAvailablePackageManagers();
  const pkg: PackageJSON = JSON.parse(
    await readFile(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'),
  );

  const apiPackageJson: PackageJSON = {
    name: mode === 'apiMonorepo' ? 'api' : appName,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc && tsc-alias -p tsconfig.json',
      start: 'node dist/index.js',
      ...(eslint
        ? {
            lint: 'eslint .',
            'lint:fix': 'eslint . --fix',
          }
        : {}),
      ...(docker && mode === 'onlyApi'
        ? {
            'docker:dev': `docker compose -f ./docker-compose.yml -p ${appName}-vitnode-dev up -d`,
          }
        : {}),
      'drizzle-kit': 'drizzle-kit',
    },
    dependencies: {
      '@hono/zod-openapi': '^0.19.8',
      '@hono/zod-validator': '^0.7.0',
      '@react-email/components': '^0.2.0',
      '@vitnode/core': `^${pkg.version}`,
      'drizzle-kit': '^0.31.3',
      'drizzle-orm': '^0.44.2',
      hono: '^4.8.3',
      'next-intl': '^4.3.1',
      react: '^19.1',
      'react-dom': '^19.1',
      zod: '^3.25.67',
    },
    devDependencies: {
      '@hono/node-server': '^1.15.0',
      '@types/node': '^24',
      '@types/react': '^19.1',
      '@types/react-dom': '^19.1',
      '@vitnode/eslint-config': `^${pkg.version}`,
      dotenv: '^17.2.0',
      ...(eslint
        ? {
            eslint: '^9.30.1',
            ...(mode === 'onlyApi'
              ? {
                  'prettier-plugin-tailwindcss': '^0.6.14',
                  prettier: '^3.6.2',
                }
              : {}),
          }
        : {}),
      'react-email': '^4.1.1',
      'tsc-alias': '^1.8.16',
      tsx: '^4.20.3',
      typescript: '^5.8.3',
    },
  };

  if (mode === 'singleApp') {
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
        '@hono/zod-openapi': '^0.19.9',
        '@hono/zod-validator': '^0.7.0',
        '@hookform/resolvers': '^5.1.1',
        '@react-email/components': '^0.2.0',
        '@vitnode/core': `^${pkg.version}`,
        'babel-plugin-react-compiler': '19.1.0-rc.2',
        'drizzle-kit': '^0.31.4',
        'drizzle-orm': '^0.44.2',
        hono: '^4.8.4',
        'lucide-react': '^0.525.0',
        next: '^15.3.5',
        'next-intl': '^4.3.4',
        react: '^19.1',
        'react-dom': '^19.1',
        'react-hook-form': '^7.60.0',
        sonner: '^2.0.6',
        zod: '^3.25.74',
      },
      devDependencies: {
        '@tailwindcss/postcss': '^4.1.11',
        '@types/node': '^24',
        '@types/react': '^19.1',
        '@types/react-dom': '^19.1',
        '@vitnode/eslint-config': `^${pkg.version}`,
        ...(eslint
          ? {
              eslint: '^9.30.1',
              'prettier-plugin-tailwindcss': '^0.6.14',
              prettier: '^3.6.2',
            }
          : {}),
        'react-email': '^4.1.1',
        turbo: '^2.5.4',
        tailwindcss: '^4.1.11',
        'tw-animate-css': '^1.3.5',
        typescript: '^5.8.3',
      },
      packageManager: `${packageManager}@${availablePackageManagers[packageManager]}`,
    };

    await writeFile(
      join(root, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );
  } else if (mode === 'apiMonorepo') {
    const rootPackageJson: PackageJSON = {
      name: appName,
      private: true,
      scripts: {
        'db:migrate': 'turbo db:migrate',
        'db:push': 'turbo db:push',
        build: 'turbo build',
        start: 'turbo start',
        dev: ' turbo dev',
        lint: 'turbo lint',
        'lint:fix': 'turbo lint:fix',
      },
      devDependencies: {
        '@types/node': '^24',
        '@vitnode/eslint-config': `^${pkg.version}`,
        ...(eslint
          ? {
              'prettier-plugin-tailwindcss': '^0.6.14',
              prettier: '^3.6.2',
            }
          : {}),
        turbo: '^2.5.4',
        typescript: '^5.8.3',
        zod: '^3.25.74',
      },
      packageManager: `${packageManager}@${availablePackageManagers[packageManager]}`,
      workspaces: ['apps/*', 'plugins/*'],
    };

    await writeFile(
      join(root, 'package.json'),
      JSON.stringify(rootPackageJson, null, 2),
    );

    await writeFile(
      join(root, 'apps', 'api', 'package.json'),
      JSON.stringify(apiPackageJson, null, 2),
    );

    const webPackageJson: PackageJSON = {
      name: 'web',
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vitnode init && next dev --turbopack',
        build: 'next build --turbopack',
        start: 'next start',
        lint: 'eslint .',
        'lint:fix': 'eslint . --fix',
      },
      dependencies: {
        '@vitnode/core': `^${pkg.version}`,
        'babel-plugin-react-compiler': '19.1.0-rc.2',
        'lucide-react': '^0.525.0',
        next: '^15.3.5',
        'next-intl': '^4.3.4',
        react: '^19.1',
        'react-dom': '^19.1',
        'react-hook-form': '^7.60.0',
        sonner: '^2.0.6',
      },
      devDependencies: {
        '@playwright/test': '^1.53.2',
        '@tailwindcss/postcss': '^4.1.11',
        '@types/mdx': '^2.0.13',
        '@types/node': '^24',
        '@types/react': '^19.1',
        '@types/react-dom': '^19.1',
        '@vitnode/eslint-config': `^${pkg.version}`,
        'class-variance-authority': '^0.7.1',
        ...(eslint
          ? {
              eslint: '^9.30.1',
            }
          : {}),
        postcss: '^8.5.6',
        'react-email': '^4.1.1',
        tailwindcss: '^4.1.11',
        'tw-animate-css': '^1.3.5',
        typescript: '^5.8.3',
        zod: '^3.25.74',
      },
    };

    await writeFile(
      join(root, 'apps', 'web', 'package.json'),
      JSON.stringify(webPackageJson, null, 2),
    );
  } else if (mode === 'onlyApi') {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify(apiPackageJson, null, 2),
    );
  }
};
