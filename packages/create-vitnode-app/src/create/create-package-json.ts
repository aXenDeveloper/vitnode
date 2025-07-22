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
        typescript: '^5.8.3',
        zod: '^4.0.5',
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
      '@hono/zod-openapi': '^1.0.2',
      '@hono/zod-validator': '^0.7.2',
      '@react-email/components': '^0.3.2',
      '@vitnode/core': pkgVitNodeVersion,
      'drizzle-kit': '^0.31.3',
      'drizzle-orm': '^0.44.3',
      hono: '^4.8.5',
      'next-intl': '^4.3.1',
      react: '^19.1',
      'react-dom': '^19.1',
      zod: '^4.0.5',
    },
    devDependencies: {
      '@hono/node-server': '^1.17.1',
      ...(packageManager === 'bun'
        ? {
            '@types/bun': 'latest',
          }
        : {}),
      '@types/node': '^24',
      '@types/react': '^19.1',
      '@types/react-dom': '^19.1',
      '@vitnode/eslint-config': pkgVitNodeVersion,
      dotenv: '^17.2.0',
      ...(eslint
        ? {
            eslint: '^9.31.0',
            ...(mode === 'onlyApi'
              ? {
                  'prettier-plugin-tailwindcss': '^0.6.14',
                  prettier: '^3.6.2',
                }
              : {}),
          }
        : {}),
      'react-email': '^4.2.3',
      'tsc-alias': '^1.8.16',
      tsx: '^4.20.3',
      typescript: '^5.8.3',
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
        '@hono/zod-openapi': '^1.0.2',
        '@hono/zod-validator': '^0.7.2',
        '@hookform/resolvers': '^5.1.1',
        '@react-email/components': '^0.3.2',
        '@vitnode/core': pkgVitNodeVersion,
        'babel-plugin-react-compiler': '19.1.0-rc.2',
        'drizzle-kit': '^0.31.4',
        'drizzle-orm': '^0.44.3',
        hono: '^4.8.5',
        'lucide-react': '^0.525.0',
        next: '^15.4.2',
        'next-intl': '^4.3.4',
        react: '^19.1',
        'react-dom': '^19.1',
        'react-hook-form': '^7.60.0',
        sonner: '^2.0.6',
        zod: '^4.0.5',
      },
      devDependencies: {
        '@tailwindcss/postcss': '^4.1.11',
        '@types/node': '^24',
        '@types/react': '^19.1',
        '@types/react-dom': '^19.1',
        '@vitnode/eslint-config': pkgVitNodeVersion,
        ...(eslint
          ? {
              eslint: '^9.31.0',
              'prettier-plugin-tailwindcss': '^0.6.14',
              prettier: '^3.6.2',
            }
          : {}),
        'react-email': '^4.2.3',
        turbo: '^2.5.5',
        tailwindcss: '^4.1.11',
        'tw-animate-css': '^1.3.5',
        typescript: '^5.8.3',
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
        'lucide-react': '^0.525.0',
        next: '^15.4.2',
        'next-intl': '^4.3.4',
        react: '^19.1',
        'react-dom': '^19.1',
        'react-hook-form': '^7.60.0',
        sonner: '^2.0.6',
      },
      devDependencies: {
        '@hookform/resolvers': '^5.1.1',
        '@tailwindcss/postcss': '^4.1.11',
        '@types/mdx': '^2.0.13',
        '@types/node': '^24',
        '@types/react': '^19.1',
        '@types/react-dom': '^19.1',
        '@vitnode/eslint-config': pkgVitNodeVersion,
        'class-variance-authority': '^0.7.1',
        ...(eslint
          ? {
              eslint: '^9.31.0',
            }
          : {}),
        postcss: '^8.5.6',
        tailwindcss: '^4.1.11',
        'tw-animate-css': '^1.3.5',
        typescript: '^5.8.3',
        zod: '^4.0.5',
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
