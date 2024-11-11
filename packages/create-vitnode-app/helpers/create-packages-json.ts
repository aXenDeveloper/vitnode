import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface PackageJSON {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: Record<string, Record<string, string>>;
  name: string;
  overrides?: Record<string, string>;
  packageManager?: string;
  pnpm?: Record<string, Record<string, string>>;
  private: boolean;
  scripts?: Record<string, string>;
  version: string;
  workspaces?: string[];
}

export const createPackagesJSON = ({
  appName,
  root,
  packageManager,
  docker,
  eslint,
}: {
  appName: string;
  docker: boolean;
  eslint: boolean;
  packageManager: string;
  root: string;
}) => {
  const pkg: PackageJSON = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
  );

  const basePackageJSON: PackageJSON = {
    name: appName,
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'turbo dev',
      build: 'turbo build',
      start: 'turbo start',
      db: 'turbo db',
      ...(eslint ? { lint: 'turbo lint', 'lint:fix': 'turbo lint:fix' } : {}),
      ...(docker
        ? {
            'docker:dev': `docker compose -f ./docker-compose-dev.yml -p vitnode-dev-${appName} up -d`,
          }
        : {}),
    },
    overrides: packageManager.startsWith('npm')
      ? {
          react: '19.0.0-rc-5c56b873-20241107',
          'react-dom': '19.0.0-rc-5c56b873-20241107',
        }
      : {},
    pnpm: packageManager.startsWith('pnpm')
      ? {
          overrides: {
            'react-is': '19.0.0-rc-5c56b873-20241107',
          },
        }
      : {},
    devDependencies: {
      ...(eslint
        ? {
            'eslint-config-typescript-vitnode': `^${pkg.version}`,
          }
        : {}),
      turbo: '^2.2.3',
    },
    packageManager,
    workspaces: ['apps/*'],
  };

  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify(basePackageJSON, null, 2),
  );

  const frontendPackagesJSON: PackageJSON = {
    name: 'frontend',
    version: '1.0.0',
    private: true,
    scripts: {
      'config:init': 'vitnode-frontend init',
      dev: 'vitnode-frontend dev && next dev --turbo',
      build: 'next build',
      start: 'next start',
      'start:prod': 'node server.js',
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix',
    },
    dependencies: {
      '@hookform/resolvers': '^3.9.1',
      geist: '^1.3.1',
      next: '^15.0.3',
      'next-intl': '^3.25.0',
      react: '19.0.0-rc-5c56b873-20241107',
      'react-dom': '19.0.0-rc-5c56b873-20241107',
      'react-hook-form': '^7.53.2',
      recharts: '^2.13.3',
      sonner: '^1.7.0',
      'vitnode-frontend': `^${pkg.version}`,
      zod: '^3.23.8',
    },
    devDependencies: {
      '@types/node': '^22.9.0',
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
      autoprefixer: '^10.4.20',
      'eslint-config-typescript-vitnode': `^${pkg.version}`,
      postcss: '^8.4.48',
      shared: 'workspace:*',
      tailwindcss: '^3.4.14',
      typescript: '^5.6.3',
      'vitnode-shared': `^${pkg.version}`,
    },
  };

  writeFileSync(
    join(root, 'apps', 'frontend', 'package.json'),
    JSON.stringify(frontendPackagesJSON, null, 2),
  );

  const backendPackagesJSON: PackageJSON = {
    name: 'backend',
    version: '1.0.0',
    private: true,
    scripts: {
      'drizzle-kit': 'drizzle-kit',
      'config:init': 'vitnode-backend init',
      dev: 'pnpm config:init && cross-env NODE_ENV=development nest start -w',
      build: 'nest build',
      start: 'node dist/main',
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix',
      db: 'vitnode-backend db',
    },
    dependencies: {
      '@nestjs/common': '^10.4.7',
      '@nestjs/core': '^10.4.7',
      '@nestjs/platform-express': '^10.4.7',
      '@nestjs/schedule': '^4.1.1',
      '@nestjs/throttler': '^6.2.1',
      '@react-email/components': '^0.0.28',
      'class-transformer': '^0.5.1',
      'class-validator': '^0.14.1',
      'drizzle-kit': '^0.28.0',
      'drizzle-orm': '^0.36.1',
      react: '19.0.0-rc-5c56b873-20241107',
      'react-dom': '19.0.0-rc-5c56b873-20241107',
      'reflect-metadata': '^0.2.2',
      'vitnode-backend': `^${pkg.version}`,
    },
    devDependencies: {
      '@nestjs/cli': '^10.4.7',
      '@nestjs/schematics': '^10.2.3',
      '@swc/cli': '^0.5.0',
      '@types/express': '^5.0.0',
      '@types/node': '^22.9.0',
      '@types/react': '^18.3.12',
      'cross-env': '^7.0.3',
      'eslint-config-typescript-vitnode': `^${pkg.version}`,
      shared: 'workspace:*',
      typescript: '^5.6.3',
      'vitnode-shared': `^${pkg.version}`,
    },
  };

  writeFileSync(
    join(root, 'apps', 'backend', 'package.json'),
    JSON.stringify(backendPackagesJSON, null, 2),
  );

  const sharedPackagesJSON: PackageJSON = {
    name: 'shared',
    version: '1.0.0',
    private: true,
    scripts: {
      build: 'tsc',
      dev: 'tsc -w',
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix',
    },
    exports: {
      './*': {
        require: './dist/*.js',
        import: './dist/*.js',
        types: './dist/*.d.ts',
      },
    },
    dependencies: {
      '@nestjs/common': '^10.4.7',
      '@nestjs/swagger': '^8.0.5',
    },
    devDependencies: {
      '@types/multer': '^1.4.12',
      '@types/node': '^22.9.0',
      'class-transformer': '^0.5.1',
      'class-validator': '^0.14.1',
      'eslint-config-typescript-vitnode': `^${pkg.version}`,
      typescript: '^5.6.3',
      'vitnode-shared': `^${pkg.version}`,
    },
  };

  writeFileSync(
    join(root, 'apps', 'shared', 'package.json'),
    JSON.stringify(sharedPackagesJSON, null, 2),
  );
};
