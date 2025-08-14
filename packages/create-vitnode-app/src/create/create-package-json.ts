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
  monorepo,
}: {
  appName: string;
  docker?: boolean;
  eslint: boolean;
  mode: CreateCliReturn['mode'];
  monorepo?: boolean;
  packageManager: string;
  root: string;
}) => {
  const availablePackageManagers = await getAvailablePackageManagers();
  const pkg: PackageJSON = JSON.parse(
    await readFile(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'),
  );
  const pkgVitNodeVersion = `^${pkg.version}`;
  const monorepoStructure = {
    api: join(root, 'apps', 'api'),
    web: join(root, 'apps', 'web'),
  };

  if (mode === 'apiMonorepo' || monorepo) {
    const rootPackageJson: PackageJSON = {
      name: appName,
      private: true,
      scripts: {
        'db:migrate': 'turbo db:migrate',
        'db:push': 'turbo db:push',
        init: 'turbo init',
        dev: 'turbo dev',
        build: 'turbo build',
        start: 'turbo start',
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
      },
      devDependencies: {
        '@types/node': '^24',
        '@vitnode/eslint-config': pkgVitNodeVersion,
        ...(eslint
          ? {
              'prettier-plugin-tailwindcss': '^0.6.14',
              prettier: '^3.6.2',
            }
          : {}),
        turbo: '^2.5.5',
        typescript: '^5.9.2',
        zod: '^4.0.17',
      },
      packageManager: `${packageManager}@${availablePackageManagers[packageManager]}`,
      workspaces: ['apps/*', 'plugins/*'],
    };

    await writeFile(
      join(root, 'package.json'),
      JSON.stringify(rootPackageJson, null, 2),
    );
  }

  const apiPackageJson: PackageJSON = {
    name: mode === 'apiMonorepo' || monorepo ? 'api' : appName,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      'db:push': 'vitnode push',
      'db:migrate': 'vitnode migrate',
      init: 'vitnode init --api',
      ...(packageManager === 'bun'
        ? {
            dev: 'vitnode init --api && bun run --hot src/index.ts',
            start: 'NODE_ENV=production bun run src/index.ts',
          }
        : {
            dev: 'vitnode init --api && tsx watch src/index.ts',
            build: 'tsc && tsc-alias -p tsconfig.json',
            start: 'node dist/index.js',
          }),
      'dev:email': 'email dev --dir src/emails',
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
      '@hono/zod-openapi': '^1.1.0',
      '@hono/zod-validator': '^0.7.2',
      '@react-email/components': '^0.5.0',
      '@vitnode/core': pkgVitNodeVersion,
      'drizzle-kit': '^0.31.3',
      'drizzle-orm': '^0.44.4',
      hono: '^4.9.1',
      'next-intl': '^4.3.1',
      react: '^19.1',
      'react-dom': '^19.1',
      'use-intl': '^4.3.4',
      zod: '^4.0.17',
    },
    devDependencies: {
      '@hono/node-server': '^1.18.2',
      ...(packageManager === 'bun'
        ? {
            '@types/bun': 'latest',
          }
        : {}),
      '@types/node': '^24',
      '@types/react': '^19.1',
      '@types/react-dom': '^19.1',
      '@vitnode/eslint-config': pkgVitNodeVersion,
      dotenv: '^17.2.1',
      ...(eslint
        ? {
            eslint: '^9.33.0',
            ...(mode === 'onlyApi'
              ? {
                  'prettier-plugin-tailwindcss': '^0.6.14',
                  prettier: '^3.6.2',
                }
              : {}),
          }
        : {}),
      'react-email': '^4.2.8',
      'tsc-alias': '^1.8.16',
      tsx: '^4.20.4',
      typescript: '^5.9.2',
    },
  };

  if (mode === 'singleApp') {
    const packageJson: PackageJSON = {
      name: monorepo ? 'web' : appName,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        'db:push': 'vitnode push',
        'db:migrate': 'vitnode migrate',
        init: 'vitnode init',
        dev: 'vitnode init && next dev --turbopack',
        'dev:email': 'email dev --dir src/emails',
        build: 'next build',
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
        '@hono/zod-openapi': '^1.1.0',
        '@hono/zod-validator': '^0.7.2',
        '@hookform/resolvers': '^5.1.1',
        '@react-email/components': '^0.5.0',
        '@vitnode/core': pkgVitNodeVersion,
        'babel-plugin-react-compiler': '19.1.0-rc.2',
        'drizzle-kit': '^0.31.4',
        'drizzle-orm': '^0.44.4',
        hono: '^4.9.1',
        'lucide-react': '^0.539.0',
        next: '^15.4.6',
        'next-intl': '^4.3.4',
        react: '^19.1',
        'react-dom': '^19.1',
        'react-hook-form': '^7.62.0',
        sonner: '^2.0.7',
        'use-intl': '^4.3.4',
        zod: '^4.0.17',
      },
      devDependencies: {
        '@tailwindcss/postcss': '^4.1.12',
        '@types/node': '^24',
        '@types/react': '^19.1',
        '@types/react-dom': '^19.1',
        '@vitnode/eslint-config': pkgVitNodeVersion,
        ...(eslint
          ? {
              eslint: '^9.33.0',
              'prettier-plugin-tailwindcss': '^0.6.14',
              prettier: '^3.6.2',
            }
          : {}),
        'react-email': '^4.2.8',
        turbo: '^2.5.5',
        tailwindcss: '^4.1.12',
        'tw-animate-css': '^1.3.6',
        typescript: '^5.9.2',
      },
      packageManager: `${packageManager}@${availablePackageManagers[packageManager]}`,
    };

    await writeFile(
      join(monorepo ? monorepoStructure.web : root, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );
  } else if (mode === 'apiMonorepo') {
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
        init: 'vitnode init --web',
        dev: 'vitnode init --web && next dev --turbopack',
        build: 'next build',
        start: 'next start',
        ...(eslint
          ? {
              lint: 'eslint .',
              'lint:fix': 'eslint . --fix',
            }
          : {}),
      },
      dependencies: {
        '@vitnode/core': pkgVitNodeVersion,
        'babel-plugin-react-compiler': '19.1.0-rc.2',
        'lucide-react': '^0.539.0',
        next: '^15.4.6',
        'next-intl': '^4.3.4',
        react: '^19.1',
        'react-dom': '^19.1',
        'react-hook-form': '^7.62.0',
        sonner: '^2.0.7',
      },
      devDependencies: {
        '@hookform/resolvers': '^5.1.1',
        '@tailwindcss/postcss': '^4.1.12',
        '@types/mdx': '^2.0.13',
        '@types/node': '^24',
        '@types/react': '^19.1',
        '@types/react-dom': '^19.1',
        '@vitnode/eslint-config': pkgVitNodeVersion,
        'class-variance-authority': '^0.7.1',
        ...(eslint
          ? {
              eslint: '^9.33.0',
            }
          : {}),
        postcss: '^8.5.6',
        tailwindcss: '^4.1.12',
        'tw-animate-css': '^1.3.6',
        typescript: '^5.9.2',
        zod: '^4.0.17',
      },
    };

    await writeFile(
      join(root, 'apps', 'web', 'package.json'),
      JSON.stringify(webPackageJson, null, 2),
    );
  } else if (mode === 'onlyApi') {
    await writeFile(
      join(monorepo ? monorepoStructure.api : root, 'package.json'),
      JSON.stringify(apiPackageJson, null, 2),
    );
  }
};
