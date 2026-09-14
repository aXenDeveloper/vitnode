import { existsSync } from "fs";
import { cp, mkdir, rename, writeFile } from "fs/promises";
import ora from "ora";
import { dirname, join, relative } from "path";
import color from "picocolors";
import { fileURLToPath } from "url";

import type { CreatePluginCliReturn } from "../questions.js";
import type { PluginConfigRegistration } from "./add-plugin-to-config.js";
import type { DevServerTarget } from "./restart-dev-servers.js";

import { getPackageManagerFromRoot } from "../../helpers/get-package-manager-from-root.js";
import { installDependencies } from "../../helpers/install-dependencies.js";
import { isFolderEmpty } from "../../helpers/is-folder-empty.js";
import { runPackageScript } from "../../helpers/run-package-script.js";
import {
  addPluginToConfig,
  needsManualRegistration,
} from "./add-plugin-to-config.js";
import { addPluginToWorkspace } from "./add-plugin-to-workspace.js";
import { createPluginPackageJSON } from "./create-package-json.js";
import { devCommandFor, restartDevServers } from "./restart-dev-servers.js";
import { pluginRouteScaffold } from "./route-templates.js";

const BUILD_SCRIPT = "build:plugins";

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

const reportConfigRegistrations = ({
  pluginName,
  registrations,
  rootPath,
}: {
  pluginName: string;
  registrations: PluginConfigRegistration[];
  rootPath: string;
}) => {
  const registered = registrations.filter(
    ({ status }) => status === "registered",
  );

  registered.forEach(({ file }) => {
    console.log(
      `  ${color.green("+")} Registered in ${color.cyan(relative(rootPath, file))}`,
    );
  });

  const unusable = needsManualRegistration(registrations);

  unusable.forEach(({ file, status }) => {
    const reason =
      status === "no-plugins-array"
        ? "has no `plugins` array"
        : "declares no VitNode config call";

    console.log(
      `  ${color.yellow("!")} ${color.cyan(relative(rootPath, file))} ${reason} - add ${color.cyan(pluginName)} to it by hand.`,
    );
  });

  if (registered.length === 0 && unusable.length === 0) {
    console.log(
      `  ${color.yellow("!")} No VitNode config found. Add ${color.cyan(`${pluginName}/config`)} to your app's \`vitnode.config.ts\` and ${color.cyan(`${pluginName}/config.api`)} to its \`vitnode.api.config.ts\`.`,
    );
  }
};

const reportDevServerRestarts = ({
  packageManager,
  pluginName,
  restarted,
  rootPath,
}: {
  packageManager: string;
  pluginName: string;
  restarted: DevServerTarget[];
  rootPath: string;
}) => {
  restarted.forEach(({ dir, kind }) => {
    const what = kind === "vite" ? "dev server and its API" : "API";
    const where = relative(rootPath, dir);

    console.log(
      `  ${color.green("\u21bb")} Restarted the ${what} in ${color.cyan(where === "" ? "." : where)}`,
    );
  });

  console.log(
    `  ${color.yellow("!")} Restart ${color.cyan(devCommandFor(packageManager))} to rebuild ${color.cyan(pluginName)} as you edit it - a plugin's own watcher starts with the dev command.`,
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

  spinner.text = "Writing the plugin's first route and API...";
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

  spinner.text = "Registering the plugin with the apps that can serve it...";
  const registrations = await addPluginToConfig({
    pluginName,
    pluginPath,
    rootPath,
  });

  let built = false;

  if (install) {
    spinner.text = "Installing dependencies...";
    await installDependencies({
      packageManager,
      cwd: pluginPath,
    });

    spinner.text = "Building the plugin...";
    const build = await runPackageScript({
      cwd: pluginPath,
      packageManager,
      script: BUILD_SCRIPT,
    });

    built = build.ok;

    if (!build.ok) {
      spinner.warn(
        `${color.yellow("Could not build")} ${color.cyan(pluginName)}. Run ${color.cyan(`${packageManager.split("@")[0]} run ${BUILD_SCRIPT}`)} in ${color.cyan(relative(rootPath, pluginPath))} and restart your dev server.`,
      );
      console.log(color.dim(build.output.trimEnd()));
      spinner.start();
    }
  }

  const restarted = built
    ? await restartDevServers({ registrations, rootPath })
    : [];

  spinner.succeed(
    `${color.green("Success!")} Created ${color.cyan(pluginName)} at ${color.cyan(pluginPath)}`,
  );

  reportConfigRegistrations({ pluginName, registrations, rootPath });

  if (built) {
    reportDevServerRestarts({
      packageManager,
      pluginName,
      restarted,
      rootPath,
    });
  }
};
