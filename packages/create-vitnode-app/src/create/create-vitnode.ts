import { existsSync } from "node:fs";
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";
import color from "picocolors";

import type { CreateCliReturn } from "../questions.js";

import { generateMigrationsVitnode } from "../helpers/init-vitnode.js";
import { installDependencies } from "../helpers/install-dependencies.js";
import { isFolderEmpty } from "../helpers/is-folder-empty.js";
import { writeEnvExample } from "./create-env-example.js";
import {
  createPackageJSON,
  projectRootScripts,
} from "./create-package-json.js";
import { renderReadme } from "./create-readme.js";

/**
 * The directories a project of this shape actually has.
 *
 * Pure, and the answer to the question every copy below asks. `apps/web` exists
 * for the two shapes with a frontend and not for the API-only one - a monorepo
 * that copied a web app's files into a `web` package that has no `package.json`
 * gets a directory nothing builds and nobody wrote, which is what an
 * `existsSync` check produced when an earlier copy had created the directory as
 * a side effect.
 */
export const projectLayout = ({
  mode,
  monorepo = false,
}: Pick<CreateCliReturn, "mode" | "monorepo">) => {
  const workspace = monorepo || mode === "apiMonorepo";

  return {
    /** Whether an `apps/api` package is written. */
    hasApi: mode !== "singleApp",
    /** Whether an `apps/web` (or flat) frontend is written. */
    hasWeb: mode !== "onlyApi",
    /** Whether the project has a workspace root above its apps. */
    workspace,
  };
};

export const createVitNode = async ({
  root,
  appName,
  packageManager,
  eslint,
  install,
  docker,
  mode,
  monorepo,
}: CreateCliReturn & {
  appName: string;
  root: string;
}) => {
  const spinner = ora(
    `Creating a new VitNode app in ${color.green(root)}. Using ${color.green(packageManager)}...`,
  ).start();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const templatePath = join(__dirname, "..", "..", "..", "copy-of-vitnode-app");
  if (!existsSync(templatePath)) {
    spinner.fail(
      `\n${color.red("Error!")} Template path ${color.cyan(templatePath)} does not exist.`,
    );
    process.exit(1);
  }

  await mkdir(root, { recursive: true });
  if (!isFolderEmpty(root, appName)) {
    process.exit(1);
  }

  const layout = projectLayout({ mode, monorepo });
  monorepo = layout.workspace;
  const monorepoStructure = {
    api: join(root, "apps", "api"),
    web: join(root, "apps", "web"),
  };
  /** Where each app lands, flat or under `apps/`. */
  const appRoot = {
    api: monorepo ? monorepoStructure.api : root,
    web: monorepo ? monorepoStructure.web : root,
  };

  spinner.text = "Preparing the project structure...";
  if (monorepo) {
    await Promise.all(
      [
        ...(layout.hasApi ? [monorepoStructure.api] : []),
        ...(layout.hasWeb ? [monorepoStructure.web] : []),
      ].map(async dir => mkdir(dir, { recursive: true })),
    );
  }

  spinner.text = "Copying files...";
  await cp(join(templatePath, ".vscode"), join(root, ".vscode"), {
    recursive: true,
  });
  if (mode === "singleApp") {
    /**
     * `root` first, then `api-single-app` over the top - sequentially, because
     * they land in the *same* directory and the order is what decides the bytes.
     *
     * The two trees share no path at all, so there is nothing left for the order
     * to decide; it stays explicit because "the overlay is applied over the
     * base" is the contract an author adding a file to either tree relies on,
     * and `Promise.all` into one destination cannot express an order.
     */
    await cp(join(templatePath, "root"), appRoot.web, { recursive: true });
    await cp(join(templatePath, "api-single-app"), appRoot.web, {
      recursive: true,
    });
  } else if (mode === "apiMonorepo") {
    // Two different destinations, so these genuinely are independent.
    await Promise.all([
      cp(join(templatePath, "root"), monorepoStructure.web, {
        recursive: true,
      }),
      cp(join(templatePath, "api"), monorepoStructure.api, {
        recursive: true,
      }),
    ]);
  } else {
    await cp(join(templatePath, "api"), appRoot.api, { recursive: true });
  }

  // The one file `api-bun` has, over the Node entry point the `api` tree ships.
  if (layout.hasApi && packageManager === "bun") {
    await cp(join(templatePath, "api-bun"), appRoot.api, { recursive: true });
  }

  /**
   * The workspace root's own files, and only for a project that has one.
   *
   * `turbo.json` and a repository-wide `.gitignore`; the apps under it bring
   * their own of the latter. Nothing in this tree belongs to an app, so a shape
   * without a frontend cannot end up with a stray `apps/web`.
   */
  if (monorepo) {
    await cp(join(templatePath, "monorepo"), root, { recursive: true });
  }

  if (eslint) {
    spinner.text = "Copying ESLint & Prettier files...";
    await Promise.all([
      ...(layout.hasApi
        ? [cp(join(templatePath, "eslint"), appRoot.api, { recursive: true })]
        : []),
      ...(layout.hasWeb
        ? [
            cp(join(templatePath, "eslint-react"), appRoot.web, {
              recursive: true,
            }),
          ]
        : []),
    ]);
  }

  spinner.text = "Renaming special files...";
  await rename(join(root, ".gitignore_template"), join(root, ".gitignore"));
  if (monorepo) {
    await Promise.all(
      [
        ...(layout.hasApi ? [monorepoStructure.api] : []),
        ...(layout.hasWeb ? [monorepoStructure.web] : []),
      ].map(async dir =>
        rename(join(dir, ".gitignore_template"), join(dir, ".gitignore")),
      ),
    );
  }

  /**
   * The environment each app starts from, composed rather than copied.
   *
   * One owner, and one per app: a single app's URLs name its own origin, a
   * standalone API's do not, and the frontend of a split deployment gets no
   * database credentials at all because it owns no schema.
   */
  spinner.text = "Writing .env.example...";
  await Promise.all([
    ...(layout.hasApi
      ? [writeEnvExample({ docker, role: "api", root: appRoot.api })]
      : []),
    ...(layout.hasWeb
      ? [
          writeEnvExample({
            docker,
            role: mode === "singleApp" ? "singleApp" : "web",
            root: appRoot.web,
          }),
        ]
      : []),
  ]);

  spinner.text = "Creating package.json...";
  await createPackageJSON({
    root,
    appName,
    packageManager,
    eslint,
    docker,
    mode,
    monorepo,
  });

  if (monorepo && packageManager === "pnpm") {
    spinner.text = "Creating pnpm-workspace.yaml...";
    const pnpmWorkspaceContent = `packages:\n  - 'apps/*'\n  - 'plugins/*'\n`;
    await writeFile(join(root, "pnpm-workspace.yaml"), pnpmWorkspaceContent);
  }

  if (docker) {
    spinner.text = "Copying docker files...";
    const dockerComposePath = join(root, "docker-compose.yml");
    await copyFile(
      join(templatePath, "docker", "docker-compose.yml"),
      dockerComposePath,
    );

    const dockerComposeContent = await readFile(dockerComposePath, "utf-8");
    await writeFile(
      dockerComposePath,
      dockerComposeContent.replaceAll(
        "vitnode_postgres_dev",
        `${appName}_vitnode_postgres_dev`,
      ),
    );
  }

  // `src/styles.css` points Tailwind at `@vitnode/core`'s compiled components
  // with a path relative to itself. npm installs into the *root* `node_modules`
  // of a workspace rather than beside each app, so in that one layout the
  // relative path has to climb further. pnpm links the package into the app's
  // own `node_modules`, where the committed path is already correct.
  if (monorepo && layout.hasWeb && packageManager === "npm") {
    spinner.text = "Updating VitNode paths...";
    const stylesPath = join(appRoot.web, "src", "styles.css");
    const stylesContent = await readFile(stylesPath, "utf-8");
    await writeFile(
      stylesPath,
      stylesContent.replaceAll(
        '@source "../node_modules/@vitnode/',
        '@source "../../../node_modules/@vitnode/',
      ),
    );
  }

  /**
   * Always written, because it is where a new project is told to copy
   * `.env.example` to `.env` before its first `dev`. It used to be inside the
   * `install` branch, so `--skip-install` produced a project with no README at
   * all - and the instruction it carries is not about installing.
   */
  spinner.text = "Preparing README...";
  await writeFile(
    join(root, "README.md"),
    renderReadme({
      appName,
      docker: !!docker,
      mode,
      packageManager,
      scripts: projectRootScripts({
        appName,
        docker: !!docker,
        eslint,
        mode,
        monorepo,
        packageManager,
      }),
      template: await readFile(join(templatePath, "README.md"), "utf-8"),
      workspace: monorepo,
    }),
  );

  if (install) {
    spinner.text = "Installing dependencies...";
    await installDependencies({
      packageManager,
      cwd: root,
    });

    spinner.text = "Generating migrations...";
    /**
     * A convenience, and awaited so a failure stops the CLI rather than being
     * reported as a success. It *generates* migrations and does not apply them,
     * and the generated `dev` script runs `vitnode db:prepare` before any
     * runtime starts - so a project whose migrations were not generated here
     * still migrates itself on first `dev`.
     */
    try {
      await generateMigrationsVitnode({
        cwd: mode === "singleApp" ? appRoot.web : appRoot.api,
      });
    } catch (error) {
      spinner.fail(
        `${color.red("Error!")} Created ${color.cyan(appName)}, but could not generate its migrations.`,
      );
      console.error(
        color.red(error instanceof Error ? error.message : String(error)),
      );
      process.exit(1);
    }
  }

  spinner.succeed(
    `${color.green("Success!")} Created ${color.cyan(appName)} at ${color.cyan(root)}`,
  );
};
