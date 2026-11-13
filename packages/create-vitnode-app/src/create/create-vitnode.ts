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

import type { InitGitResult } from "../helpers/init-git.js";
import type { CreateCliReturn } from "../questions.js";

import { getAvailablePackageManagers } from "../helpers/get-available-package-managers.js";
import { initGitRepository } from "../helpers/init-git.js";
import { generateMigrationsVitnode } from "../helpers/init-vitnode.js";
import { installDependencies } from "../helpers/install-dependencies.js";
import { isFolderEmpty } from "../helpers/is-folder-empty.js";
import { createDockerFiles } from "./create-docker.js";
import { createPackageJSON } from "./create-package-json.js";

const GIT_WARNINGS: Record<Exclude<InitGitResult, "created">, string> = {
  "already-in-repository":
    "Skipped git setup - the project already lives inside a git repository.",
  failed:
    'Could not initialize a git repository. Run "git init" in the project yourself once git is configured.',
  "git-unavailable":
    'Git is not installed, so no repository was created. Run "git init" in the project after installing git.',
};

/**
 * A Cloudflare Worker name from the project name: lowercase letters, digits
 * and dashes, at most 63 characters.
 */
export const workerNameOf = (appName: string): string =>
  appName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || "vitnode";

/** The nitro options line of the templates' `vite.config.ts`. */
const NITRO_OPTIONS_LINE =
  "      nitro: { rollupConfig: { external: [/^@sentry\\//] } },";

const BUN_NITRO_OPTIONS = `      nitro: {
        // Built for Bun: the server runs on Bun.serve, and \`vitnode start\`
        // starts it with Bun.
        preset: "bun",
        rollupConfig: { external: [/^@sentry\\//] },
      },`;

const CLOUDFLARE_GITIGNORE = `
# Cloudflare (Wrangler)
.wrangler
.dev.vars*
!.dev.vars.example
`;

export const createVitNode = async ({
  root,
  appName,
  deploy,
  packageManager,
  oxlint,
  git,
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
  const monorepoStructure = {
    api: join(root, "apps", "api"),
    web: join(root, "apps", "web"),
  };

  spinner.text = "Preparing the project structure...";
  if (monorepo || mode === "apiMonorepo") {
    monorepo = true;
    const dirsToCreate: string[] = [];
    if (mode === "apiMonorepo" || (monorepo && mode === "onlyApi")) {
      dirsToCreate.push(monorepoStructure.api);
    }
    if (mode === "apiMonorepo" || (monorepo && mode === "singleApp")) {
      dirsToCreate.push(monorepoStructure.web);
    }
    await Promise.all(
      dirsToCreate.map(async dir => mkdir(dir, { recursive: true })),
    );
  }

  spinner.text = "Copying files...";
  await cp(join(templatePath, ".vscode"), join(root, ".vscode"), {
    recursive: true,
  });
  if (mode === "singleApp") {
    const destination = monorepo ? monorepoStructure.web : root;

    /**
     * `root` first, then `api-single-app` over the top - sequentially, because
     * they land in the *same* directory and the order is what decides the
     * bytes.
     *
     * It was one `Promise.all`, which is a race whenever the two trees share a
     * path. They shared two: `.gitignore_template` and `.env.example`. The
     * overlay's copies were stale - missing `.output`, `.nitro` and the
     * generated `src/*.gen.ts`, and dropping `VITNODE_API_URL` and
     * `CRON_SECRET` from the environment - so which of the two a new project got
     * depended on which `cp` finished last. Both are deleted; `root` owns every
     * generic host file and `api-single-app` is a true overlay of API-specific
     * additions.
     *
     * The order stays explicit anyway. There is nothing overlapping left to
     * decide, but "the overlay is applied over the base" is the contract, and it
     * is the one an author adding a file to either tree needs to be able to
     * rely on.
     */
    await cp(join(templatePath, "root"), destination, { recursive: true });
    await cp(join(templatePath, "api-single-app"), destination, {
      recursive: true,
    });

    // Cloudflare Workers: the Worker preset, the realtime hub's Wrangler
    // config and a per-request database client, over the same app.
    if (deploy === "cloudflare") {
      await cp(join(templatePath, "cloudflare"), destination, {
        recursive: true,
      });
      const wranglerPath = join(destination, "wrangler.jsonc");
      await writeFile(
        wranglerPath,
        (await readFile(wranglerPath, "utf-8")).replace(
          "{{WORKER_NAME}}",
          workerNameOf(appName),
        ),
      );
      const gitignorePath = join(destination, ".gitignore_template");
      await writeFile(
        gitignorePath,
        (await readFile(gitignorePath, "utf-8")) + CLOUDFLARE_GITIGNORE,
      );
    }
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

    if (deploy === "bun") {
      await cp(join(templatePath, "api-bun"), monorepoStructure.api, {
        recursive: true,
      });
    }
  } else if (mode === "onlyApi") {
    await cp(
      join(templatePath, "api"),
      monorepo ? monorepoStructure.api : root,
      {
        recursive: true,
      },
    );

    if (deploy === "bun") {
      await cp(
        join(templatePath, "api-bun"),
        monorepo ? monorepoStructure.api : root,
        {
          recursive: true,
        },
      );
    }
  }

  if (mode === "apiMonorepo" || (monorepo && mode !== "singleApp")) {
    await cp(join(templatePath, "monorepo"), root, {
      recursive: true,
    });
  } else if (monorepo && mode === "singleApp") {
    // Copy only the necessary monorepo files, excluding the api folder
    await copyFile(
      join(templatePath, "monorepo", "turbo.json"),
      join(root, "turbo.json"),
    );
    await copyFile(
      join(templatePath, "monorepo", ".gitignore_template"),
      join(root, ".gitignore_template"),
    );
  }

  if (deploy === "bun" && mode !== "onlyApi") {
    const viteConfigPath = join(
      monorepo || mode === "apiMonorepo" ? monorepoStructure.web : root,
      "vite.config.ts",
    );
    const viteConfig = await readFile(viteConfigPath, "utf-8");
    const withBunPreset = viteConfig.replace(
      NITRO_OPTIONS_LINE,
      BUN_NITRO_OPTIONS,
    );
    if (withBunPreset === viteConfig) {
      throw new Error(
        `Could not set Nitro's bun preset in ${viteConfigPath}: the template's nitro options changed.`,
      );
    }
    await writeFile(viteConfigPath, withBunPreset);
  }

  if (oxlint) {
    spinner.text = "Copying Oxlint & Oxfmt files...";
    if (monorepo) {
      if (existsSync(monorepoStructure.api)) {
        await cp(join(templatePath, "oxlint"), monorepoStructure.api, {
          recursive: true,
        });
      }
      if (existsSync(monorepoStructure.web)) {
        await cp(join(templatePath, "oxlint-react"), monorepoStructure.web, {
          recursive: true,
        });
      }
    } else {
      if (mode === "onlyApi") {
        await cp(join(templatePath, "oxlint"), root, {
          recursive: true,
        });
      } else if (mode === "singleApp") {
        await cp(join(templatePath, "oxlint-react"), root, {
          recursive: true,
        });
      }
    }
  }

  spinner.text = "Renaming special files...";
  await rename(join(root, ".gitignore_template"), join(root, ".gitignore"));
  if (mode === "apiMonorepo" || monorepo) {
    if (existsSync(join(monorepoStructure.api, ".gitignore_template"))) {
      await rename(
        join(monorepoStructure.api, ".gitignore_template"),
        join(monorepoStructure.api, ".gitignore"),
      );
    }
    if (existsSync(join(monorepoStructure.web, ".gitignore_template"))) {
      await rename(
        join(monorepoStructure.web, ".gitignore_template"),
        join(monorepoStructure.web, ".gitignore"),
      );
    }
  }

  spinner.text = "Creating package.json...";
  await createPackageJSON({
    root,
    appName,
    deploy,
    packageManager,
    oxlint,
    docker,
    mode,
    monorepo,
  });

  if ((mode === "apiMonorepo" || monorepo) && packageManager === "pnpm") {
    spinner.text = "Creating pnpm-workspace.yaml...";
    const pnpmWorkspaceContent = `packages:\n  - 'apps/*'\n  - 'plugins/*'\n`;
    await writeFile(join(root, "pnpm-workspace.yaml"), pnpmWorkspaceContent);
  }

  if (docker) {
    spinner.text = "Copying docker files...";
    await copyFile(
      join(templatePath, "docker", "docker-compose.yml"),
      join(root, "docker-compose.yml"),
    );

    const dockerComposePath = join(root, "docker-compose.yml");
    const dockerComposeContent = await readFile(dockerComposePath, "utf-8");
    const updatedContent = dockerComposeContent.replace(
      /vitnode_postgres_dev/g,
      `${appName}_vitnode_postgres_dev`,
    );
    await writeFile(dockerComposePath, updatedContent);

    // A Worker is deployed with Wrangler, not as a container.
    if (deploy !== "cloudflare") {
      const pmVersions = await getAvailablePackageManagers();
      await createDockerFiles({
        appName,
        deploy,
        mode,
        monorepo: !!monorepo,
        packageManager,
        pmVersion: pmVersions[packageManager],
        root,
      });
    }
  }

  // `src/styles.css` points Tailwind at `@vitnode/core`'s compiled components
  // with a path relative to itself. npm installs into the *root* `node_modules`
  // of a workspace rather than beside each app, so in that one layout the
  // relative path has to climb further. pnpm links the package into the app's
  // own `node_modules`, where the committed path is already correct.
  spinner.text = "Updating VitNode paths...";
  if (
    (mode === "apiMonorepo" || monorepo) &&
    packageManager === "npm" &&
    mode !== "onlyApi"
  ) {
    const stylesPath = join(monorepoStructure.web, "src", "styles.css");
    const stylesContent = await readFile(stylesPath, "utf-8");
    await writeFile(
      stylesPath,
      stylesContent.replaceAll(
        '@source "../node_modules/@vitnode/',
        '@source "../../../node_modules/@vitnode/',
      ),
    );
  }

  if (mode === "apiMonorepo") {
    spinner.text = "Setting up environment variables...";
    const envExamplePath = join(monorepoStructure.web, ".env.example");
    if (existsSync(envExamplePath)) {
      await rename(envExamplePath, join(monorepoStructure.web, ".env"));
    }
  }

  if (install) {
    spinner.text = "Installing dependencies...";
    await installDependencies({
      packageManager,
      cwd: root,
    });

    spinner.text = "Preparing README...";
    await copyFile(join(templatePath, "README.md"), join(root, "README.md"));
    let readmeContent = await readFile(join(root, "README.md"), "utf-8");
    readmeContent = readmeContent.replaceAll("pnpm", packageManager);

    let startUrlsText = "[http://localhost:3000](http://localhost:3000)";
    if (mode === "onlyApi") {
      startUrlsText = "[http://localhost:8000](http://localhost:8000)";
    } else if (mode === "apiMonorepo") {
      startUrlsText =
        "[http://localhost:3000](http://localhost:3000) for the Web app and [http://localhost:8000](http://localhost:8000) for the API";
    }

    readmeContent = readmeContent.replace("{{START_URLS}}", startUrlsText);
    if (deploy === "cloudflare") {
      const run = packageManager === "npm" ? "npm run" : packageManager;
      readmeContent += `
## Deploy to Cloudflare Workers

\`${run} dev\` runs the app on Node for development. To run the real Worker,
with WebSockets served by the \`VitNodeRealtimeHub\` Durable Object, copy
\`.dev.vars.example\` to \`.dev.vars\`, then:

\`\`\`bash
${run} build
${run} preview
\`\`\`

To deploy, set each secret once with
\`npx wrangler secret put POSTGRES_URL\`,
then run \`${run} check:cloudflare\` (a dry run) and
\`${run} deploy:cloudflare\`. See
[Cloudflare Workers](https://vitnode.com/docs/dev/deployments/cloud/cloudflare) in the docs.
`;
    }
    if (docker && deploy !== "cloudflare") {
      readmeContent += `
## Deploy with Docker

\`Dockerfile\` builds the production image and \`docker-compose.prod.yml\` runs
it with PostgreSQL, Redis and a one-off migration job. Put
\`POSTGRES_PASSWORD\`, \`REDIS_PASSWORD\`, \`VITNODE_WEB_URL\` and \`CRON_SECRET\`${
        mode === "apiMonorepo" ? " (and `VITNODE_API_URL`)" : ""
      }
in \`.env.production\`, then:

\`\`\`bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
\`\`\`

See [Docker](https://vitnode.com/docs/dev/deployments/docker) in the docs.
`;
    }
    await writeFile(join(root, "README.md"), readmeContent);

    spinner.text = "Generating migrations...";
    let migrationsCwd: string;
    if (mode === "apiMonorepo" || (monorepo && mode !== "singleApp")) {
      migrationsCwd = monorepoStructure.api;
    } else if (mode === "singleApp" && monorepo) {
      migrationsCwd = monorepoStructure.web;
    } else {
      migrationsCwd = root;
    }
    /**
     * Awaited, and a failure stops the CLI rather than being reported as a
     * success.
     *
     * It used to be called without `await` around a `spawn` nobody listened to,
     * two lines above `spinner.succeed("Success! Created …")` - so the message
     * printed while `drizzle-kit` was still running, a non-zero exit was never
     * seen, and the process could exit leaving the child writing into a
     * directory the user had been told was finished.
     *
     * This is a convenience: it *generates* migrations, it does not apply them,
     * and the generated `dev` script runs `vitnode db:prepare` before any
     * runtime starts - so a project whose migrations were not generated here
     * still migrates itself on first `dev`. The failure is surfaced anyway,
     * because the alternative is a CLI that says "Success!" about work it knows
     * did not happen.
     */
    try {
      await generateMigrationsVitnode({
        packageManager,
        cwd: migrationsCwd,
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

  let gitResult: InitGitResult | undefined;
  if (git) {
    spinner.text = "Initializing git repository...";
    gitResult = await initGitRepository({ root });
  }

  spinner.succeed(
    `${color.green("Success!")} Created ${color.cyan(appName)} at ${color.cyan(root)}`,
  );

  if (gitResult && gitResult !== "created") {
    console.log(color.yellow(GIT_WARNINGS[gitResult]));
  }
};
