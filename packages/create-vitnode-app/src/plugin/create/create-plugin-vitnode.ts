import { existsSync } from "fs";
import { cp, mkdir, rename, writeFile } from "fs/promises";
import ora from "ora";
import { dirname, join } from "path";
import color from "picocolors";
import { fileURLToPath } from "url";

import type { CreatePluginCliReturn } from "../questions.js";

import { getPackageManagerFromRoot } from "../../helpers/get-package-manager-from-root.js";
import { installDependencies } from "../../helpers/install-dependencies.js";
import { isFolderEmpty } from "../../helpers/is-folder-empty.js";
import { addPluginToWorkspace } from "./add-plugin-to-workspace.js";
import { createPluginPackageJSON } from "./create-package-json.js";
import { pluginRouteScaffold } from "./route-templates.js";

/**
 * The plugin's own source: one public page, its strings, and the config that
 * registers both.
 *
 * Written rather than copied, because every one of these files names the plugin
 * - the route tree names the URL it claims, the page names the message namespace
 * it renders, the config names the id both are keyed by - and a static template
 * under `copy-of-vitnode-plugin/` cannot. What each file contains is
 * `route-templates.ts`, which is pure and asserted byte for byte; this is only
 * the part that has a disk.
 *
 * Nothing here touches the application. A new plugin is registered by adding it
 * to an app's `src/vitnode.config.ts`, and its page reaches the browser from its
 * own `dist` - so there is no generated file to edit, no route to copy and
 * nothing in `apps/*` for a plugin author to know about.
 */
const writePluginRouteScaffold = async ({
  pluginName,
  pluginPath,
}: {
  pluginName: string;
  pluginPath: string;
}) => {
  const files = pluginRouteScaffold(pluginName);

  await Promise.all(
    Object.keys(files).map(async file =>
      mkdir(dirname(join(pluginPath, file)), { recursive: true }),
    ),
  );

  await Promise.all(
    Object.entries(files).map(async ([file, contents]) =>
      writeFile(join(pluginPath, file), contents, "utf-8"),
    ),
  );
};

export const createPluginVitNode = async ({
  pluginPath,
  pluginName,
  install,
  eslint,
}: CreatePluginCliReturn & {
  eslint: boolean;
  pluginName: string;
  pluginPath: string;
}) => {
  const packageManager = getPackageManagerFromRoot(process.cwd());

  const spinner = ora(
    `Creating a new VitNode plugin in ${color.green(pluginPath)}. Using ${color.green(packageManager)}...`,
  ).start();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const templatePath = join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "copy-of-vitnode-plugin",
    "root",
  );
  if (!existsSync(templatePath)) {
    spinner.fail(
      `\n${color.red("Error!")} Template path ${color.cyan(templatePath)} does not exist.`,
    );
    process.exit(1);
  }

  await mkdir(pluginPath, { recursive: true });
  if (!isFolderEmpty(pluginPath, pluginName)) {
    process.exit(1);
  }

  spinner.text = "Preparing the plugin structure...";
  await cp(templatePath, pluginPath, { recursive: true });

  const npmIgnoreTemplatePath = join(pluginPath, "npmignore.template");
  const dotNpmIgnorePath = join(pluginPath, ".npmignore");
  if (existsSync(npmIgnoreTemplatePath)) {
    await rename(npmIgnoreTemplatePath, dotNpmIgnorePath);
  }

  spinner.text = "Writing the plugin's first route...";
  await writePluginRouteScaffold({ pluginName, pluginPath });

  spinner.text = "Creating package.json...";
  await createPluginPackageJSON({
    pluginName,
    pluginPath,
    eslint,
  });

  if (eslint) {
    spinner.text = "Setting up ESLint...";
    const templateEslintPath = join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "copy-of-vitnode-app",
      "eslint-react",
    );

    if (!existsSync(templateEslintPath)) {
      spinner.fail(
        `\n${color.red("Error!")} ESLint template path ${color.cyan(
          templateEslintPath,
        )} does not exist.`,
      );
      process.exit(1);
    }

    await cp(templateEslintPath, pluginPath, { recursive: true });
  }

  // Find the root of the monorepo (where turbo.json is located)
  let rootPath = process.cwd();
  let currentDir = rootPath;
  while (currentDir !== dirname(currentDir)) {
    if (existsSync(join(currentDir, "turbo.json"))) {
      rootPath = currentDir;
      break;
    }
    currentDir = dirname(currentDir);
  }

  spinner.text = "Adding plugin to workspace packages...";
  await addPluginToWorkspace({
    packageManager,
    pluginName,
    pluginPath,
    rootPath,
  });

  if (install) {
    spinner.text = "Installing dependencies...";
    await installDependencies({
      packageManager,
      cwd: pluginPath,
    });
  }

  spinner.succeed(
    `${color.green("Success!")} Created ${color.cyan(pluginName)} at ${color.cyan(pluginPath)}`,
  );
};
