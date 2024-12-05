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
      'config:init': 'turbo config:init',
      dev: 'turbo dev',
      build: 'turbo build',
      start: 'turbo start',
      db: 'turbo db',
      ...(eslint ? { lint: 'turbo lint', 'lint:fix': 'turbo lint:fix' } : {}),
      ...(docker
        ? {
            'docker:dev': `docker compose -f ./docker-compose-dev.yml -p vitnode-dev-${appName} up -d`,
            'docker:prod': `docker compose -f ./docker-compose.yml -p vitnode-prod-${appName} up -d`,
          }
        : {}),
    },
    overrides: packageManager.startsWith('npm')
      ? {
          react: '19.0.0-rc.1',
          'react-dom': '19.0.0-rc.1',
        }
      : {},
    pnpm: packageManager.startsWith('pnpm')
      ? {
          overrides: {
            'react-is': '19.0.0-rc.1',
          },
        }
      : {},
    devDependencies: {
      ...(eslint
        ? {
            'eslint-config-typescript-vitnode': `^${pkg.version}`,
          }
        : {}),
      turbo: '^2.3.3',
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
      postinstall: 'vitnode-frontend init',
      dev: 'next dev --turbo',
      build: 'next build',
      start: 'next start',
      'start:prod': 'node server.js',
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix',
    },
    dependencies: {
      '@hookform/resolvers': '^3.9.1',
      geist: '^1.3.1',
      'lucide-react': '^0.468.0',
      next: '^15.0.3',
      'next-intl': '^3.25.3',
      react: '19.0.0-rc.1',
      'react-dom': '19.0.0-rc.1',
      'react-hook-form': '^7.53.2',
      recharts: '^2.14.1',
      sonner: '^1.7.0',
      'vitnode-frontend': `^${pkg.version}`,
      zod: '^3.23.8',
    },
    devDependencies: {
      '@types/node': '^22.10.1',
      '@types/react': '^18.3.13',
      '@types/react-dom': '^18.3.1',
      autoprefixer: '^10.4.20',
      'eslint-config-typescript-vitnode': `^${pkg.version}`,
      postcss: '^8.4.49',
      shared: packageManager.startsWith('npm') ? '*' : 'workspace:*',
      tailwindcss: '^3.4.16',
      typescript: '^5.7.2',
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
      dev: 'vitnode-backend init && cross-env NODE_ENV=development nest start -w',
      build: 'nest build',
      start: 'node dist/main',
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix',
      db: 'vitnode-backend db',
    },
    dependencies: {
      '@nestjs/common': '^10.4.13',
      '@nestjs/core': '^10.4.13',
      '@nestjs/platform-express': '^10.4.13',
      '@nestjs/schedule': '^4.1.1',
      '@react-email/components': '^0.0.29',
      'class-transformer': '^0.5.1',
      'class-validator': '^0.14.1',
      'drizzle-kit': '^0.29.1',
      'drizzle-orm': '^0.37.0',
      react: '19.0.0-rc.1',
      'react-dom': '19.0.0-rc.1',
      'reflect-metadata': '^0.2.2',
      'vitnode-backend': `^${pkg.version}`,
    },
    devDependencies: {
      '@nestjs/cli': '^10.4.8',
      '@nestjs/schematics': '^10.2.3',
      '@swc/cli': '^0.5.2',
      '@types/express': '^5.0.0',
      '@types/node': '^22.10.1',
      '@types/react': '^18.3.13',
      'cross-env': '^7.0.3',
      'eslint-config-typescript-vitnode': `^${pkg.version}`,
      shared: packageManager.startsWith('npm') ? '*' : 'workspace:*',
      typescript: '^5.7.2',
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
      '@nestjs/common': '^10.4.13',
      '@nestjs/swagger': '^8.1.0',
    },
    devDependencies: {
      '@types/multer': '^1.4.12',
      '@types/node': '^22.10.1',
      'class-transformer': '^0.5.1',
      'class-validator': '^0.14.1',
      'eslint-config-typescript-vitnode': `^${pkg.version}`,
      typescript: '^5.7.2',
      'vitnode-shared': `^${pkg.version}`,
    },
  };

  writeFileSync(
    join(root, 'apps', 'shared', 'package.json'),
    JSON.stringify(sharedPackagesJSON, null, 2),
  );
};
