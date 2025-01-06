import { readFile, writeFile } from 'fs/promises';
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

export const createPackagesJSON = async ({
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
    await readFile(join(__dirname, '..', 'package.json'), 'utf-8'),
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
            'docker:dev': `docker compose -f ./docker-compose-dev.yml -p ${appName}-dev up -d`,
            'docker:prod': `docker compose -f ./docker-compose.yml -p ${appName} up -d`,
          }
        : {}),
    },
    dependencies: {
      turbo: '^2.3.3',
    },
    ...(eslint
      ? {
          devDependencies: {
            'eslint-config-typescript-vitnode': `^${pkg.version}`,
          },
        }
      : {}),
    packageManager,
    workspaces: ['apps/*'],
  };

  await writeFile(
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
      autoprefixer: '^10.4.20',
      'eslint-config-typescript-vitnode': `^${pkg.version}`,
      geist: '^1.3.1',
      'lucide-react': '^0.469.0',
      next: '^15.1.3',
      'next-intl': '4.0.0-beta-ddd5ae5',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'react-hook-form': '^7.54.2',
      recharts: '^2.15.0',
      shiki: '^1.26.1',
      sonner: '^1.7.1',
      shared: packageManager.startsWith('npm') ? '*' : 'workspace:*',
      'vitnode-frontend': `^${pkg.version}`,
      zod: '^3.24.1',
    },
    devDependencies: {
      '@types/node': '^22.10.5',
      '@types/react': '^19.0.3',
      '@types/react-dom': '^19.0.2',
      postcss: '^8.4.49',
      tailwindcss: '^3.4.17',
      typescript: '^5.7.2',
      'vitnode-shared': `^${pkg.version}`,
    },
  };

  await writeFile(
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
      '@nestjs/cache-manager': '^3.0.0-next.0',
      '@nestjs/cli': '^10.4.9',
      '@nestjs/common': '^10.4.15',
      '@nestjs/core': '^10.4.15',
      '@nestjs/platform-express': '^10.4.15',
      '@nestjs/schedule': '^4.1.2',
      '@nestjs/swagger': '^8.1.0',
      '@react-email/components': '^0.0.31',
      'class-transformer': '^0.5.1',
      'class-validator': '^0.14.1',
      'drizzle-kit': '^0.30.1',
      'drizzle-orm': '^0.38.3',
      'eslint-config-typescript-vitnode': `^${pkg.version}`,
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'reflect-metadata': '^0.2.2',
      shared: packageManager.startsWith('npm') ? '*' : 'workspace:*',
      'vitnode-backend': `^${pkg.version}`,
      'vitnode-shared': `^${pkg.version}`,
    },
    devDependencies: {
      '@nestjs/schematics': '^10.2.3',
      '@swc/cli': '^0.5.2',
      '@types/express': '^5.0.0',
      '@types/node': '^22.10.5',
      '@types/react': '^19.0.3',
      'cross-env': '^7.0.3',
      typescript: '^5.7.2',
    },
  };

  await writeFile(
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
      '@nestjs/common': '^10.4.15',
      '@nestjs/swagger': '^8.1.0',
      'class-transformer': '^0.5.1',
      'class-validator': '^0.14.1',
      'eslint-config-typescript-vitnode': `^${pkg.version}`,
      'vitnode-shared': `^${pkg.version}`,
      typescript: '^5.7.2',
    },
    devDependencies: {
      '@types/multer': '^1.4.12',
      '@types/node': '^22.10.5',
    },
  };

  await writeFile(
    join(root, 'apps', 'shared', 'package.json'),
    JSON.stringify(sharedPackagesJSON, null, 2),
  );
};
