import { existsSync } from "fs";
import { cp, mkdir, rename } from "fs/promises";
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
