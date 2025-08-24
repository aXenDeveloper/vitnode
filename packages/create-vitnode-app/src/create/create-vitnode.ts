import { existsSync } from 'node:fs';
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ora from 'ora';
import color from 'picocolors';
import {
  generateMigrationsVitnode,
  initFilesVitnode,
} from '../helpers/init-vitnode.js';
import { installDependencies } from '../helpers/install-dependencies.js';
import { isFolderEmpty } from '../helpers/is-folder-empty.js';
import type { CreateCliReturn } from '../questions.js';
import { createPackageJSON } from './create-package-json.js';

export const createVitNode = async ({
  root,
  appName,
  packageManager,
  biome,
  install,
  docker,
  mode,
  monorepo,
}: CreateCliReturn & {
  appName: string;
  root: string;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <needed>
}) => {
  const spinner = ora(
    `Creating a new VitNode app in ${color.green(root)}. Using ${color.green(packageManager)}...`,
  ).start();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const templatePath = join(__dirname, '..', '..', '..', 'copy-of-vitnode-app');
  if (!existsSync(templatePath)) {
    spinner.fail(
      `\n${color.red('Error!')} Template path ${color.cyan(templatePath)} does not exist.`,
    );
    process.exit(1);
  }

  // Create the folder
  await mkdir(root, { recursive: true });
  if (!isFolderEmpty(root, appName)) {
    process.exit(1);
  }
  const monorepoStructure = {
    api: join(root, 'apps', 'api'),
    web: join(root, 'apps', 'web'),
  };

  spinner.text = 'Preparing the project structure...';
  if (monorepo || mode === 'apiMonorepo') {
    const dirsToCreate: string[] = [];
    if (mode === 'apiMonorepo' || (monorepo && mode === 'onlyApi')) {
      dirsToCreate.push(monorepoStructure.api);
    }
    if (mode === 'apiMonorepo' || (monorepo && mode === 'singleApp')) {
      dirsToCreate.push(monorepoStructure.web);
    }
    await Promise.all(
      dirsToCreate.map(async dir => mkdir(dir, { recursive: true })),
    );
  }

  spinner.text = 'Copying files...';
  await cp(join(templatePath, '.vscode'), join(root, '.vscode'), {
    recursive: true,
  });
  if (mode === 'singleApp') {
    await Promise.all([
      cp(join(templatePath, 'root'), monorepo ? monorepoStructure.web : root, {
        recursive: true,
      }),
      cp(
        join(templatePath, 'api-single-app'),
        monorepo ? monorepoStructure.web : root,
        {
          recursive: true,
        },
      ),
    ]);
  } else if (mode === 'apiMonorepo') {
    await Promise.all([
      cp(join(templatePath, 'root'), monorepoStructure.web, {
        recursive: true,
      }),
      cp(join(templatePath, 'api'), monorepoStructure.api, {
        recursive: true,
      }),
    ]);

    if (packageManager === 'bun') {
      await cp(join(templatePath, 'api-bun'), monorepoStructure.api, {
        recursive: true,
      });
    }
  } else if (mode === 'onlyApi') {
    await cp(
      join(templatePath, 'api'),
      monorepo ? monorepoStructure.api : root,
      {
        recursive: true,
      },
    );

    if (packageManager === 'bun') {
      await cp(
        join(templatePath, 'api-bun'),
        monorepo ? monorepoStructure.api : root,
        {
          recursive: true,
        },
      );
    }
  }

  if (mode === 'apiMonorepo' || monorepo) {
    await cp(join(templatePath, 'monorepo'), root, {
      recursive: true,
    });
  }

  if (biome) {
    spinner.text = 'Copying Biome files...';
    await cp(join(templatePath, 'biome'), root, {
      recursive: true,
    });
  }

  spinner.text = 'Renaming special files...';
  await rename(join(root, '.gitignore_template'), join(root, '.gitignore'));
  if (mode === 'apiMonorepo' || monorepo) {
    if (existsSync(join(monorepoStructure.api, '.gitignore_template'))) {
      await rename(
        join(monorepoStructure.api, '.gitignore_template'),
        join(monorepoStructure.api, '.gitignore'),
      );
    }
    if (existsSync(join(monorepoStructure.web, '.gitignore_template'))) {
      await rename(
        join(monorepoStructure.web, '.gitignore_template'),
        join(monorepoStructure.web, '.gitignore'),
      );
    }
  }

  spinner.text = 'Creating package.json...';
  await createPackageJSON({
    root,
    appName,
    packageManager,
    biome,
    docker,
    mode,
    monorepo,
  });

  if ((mode === 'apiMonorepo' || monorepo) && packageManager === 'pnpm') {
    spinner.text = 'Creating pnpm-workspace.yaml...';
    const pnpmWorkspaceContent = `packages:\n  - 'apps/*'\n  - 'plugins/*'\n`;
    await writeFile(join(root, 'pnpm-workspace.yaml'), pnpmWorkspaceContent);
  }

  if (docker) {
    spinner.text = 'Copying docker files...';
    await copyFile(
      join(templatePath, 'docker', 'docker-compose.yml'),
      join(root, 'docker-compose.yml'),
    );

    // Update docker-compose.yml with app name
    const dockerComposePath = join(root, 'docker-compose.yml');
    const dockerComposeContent = await readFile(dockerComposePath, 'utf-8');
    const updatedContent = dockerComposeContent.replace(
      /vitnode_postgres_dev/g,
      `${appName}_vitnode_postgres_dev`,
    );
    await writeFile(dockerComposePath, updatedContent);
  }

  spinner.text = 'Updating VitNode paths...';
  if (
    (mode === 'apiMonorepo' || monorepo) &&
    packageManager !== 'pnpm' &&
    mode !== 'onlyApi'
  ) {
    const globalCssPath = join(
      monorepoStructure.web,
      'src',
      'app',
      'global.css',
    );
    const globalCssContent = await readFile(globalCssPath, 'utf-8');
    const updatedGlobalCssContent = globalCssContent.replaceAll(
      '@source "../../node_modules/@vitnode/',
      '@source "../../../../node_modules/@vitnode/',
    );
    await writeFile(globalCssPath, updatedGlobalCssContent);
  }

  if (mode === 'apiMonorepo') {
    spinner.text = 'Setting up environment variables...';
    const envExamplePath = join(monorepoStructure.web, '.env.example');
    if (existsSync(envExamplePath)) {
      await rename(envExamplePath, join(monorepoStructure.web, '.env'));
    }
  }

  if (install) {
    spinner.text = 'Installing dependencies...';
    await installDependencies({
      packageManager,
      cwd: root,
    });

    spinner.text = 'Initializing VitNode files...';
    if (mode === 'apiMonorepo') {
      await Promise.all([
        initFilesVitnode({
          packageManager,
          cwd: monorepoStructure.web,
          flag: 'web',
        }),
        initFilesVitnode({
          packageManager,
          cwd: monorepoStructure.api,
          flag: 'api',
        }),
        initFilesVitnode({
          packageManager,
          cwd: root,
        }),
      ]);
    } else {
      initFilesVitnode({
        packageManager,
        cwd: root,
      });
    }

    spinner.text = 'Generating migrations...';
    let migrationsCwd: string;
    if (mode === 'apiMonorepo' || (monorepo && mode !== 'singleApp')) {
      migrationsCwd = monorepoStructure.api;
    } else if (mode === 'singleApp' && monorepo) {
      migrationsCwd = monorepoStructure.web;
    } else {
      migrationsCwd = root;
    }
    generateMigrationsVitnode({
      packageManager,
      cwd: migrationsCwd,
    });
  }

  spinner.succeed(
    `${color.green('Success!')} Created ${color.cyan(appName)} at ${color.cyan(root)}`,
  );
};
