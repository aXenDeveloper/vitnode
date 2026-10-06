import { writeFile } from "fs/promises";
import { join } from "path";

import type { PackageJSON } from "../helpers/packages-json.js";
import type { CreateCliReturn } from "../questions.js";

import { getAvailablePackageManagers } from "../helpers/get-available-package-managers.js";
import { getVitnodePackageVersion } from "../helpers/get-vitnode-package-version.js";
import { withIf } from "../helpers/with-If.js";
import { versionsPackageJson } from "./package-versions.js";

type Mode = CreateCliReturn["mode"];

const writeJson = async (path: string, data: unknown) =>
  writeFile(path, JSON.stringify(data, null, 2));

const paths = (root: string) => ({
  root,
  api: join(root, "apps", "api"),
  web: join(root, "apps", "web"),
});

/**
 * Shared blocks
 */
const eslintScripts = {
  lint: "eslint .",
  "lint:fix": "eslint . --fix",
};
const i18nCommands = [
  "i18n:create",
  "i18n:check",
  "i18n:delete",
  "i18n:update",
  "i18n:update:ai",
] as const;
/** `i18n:update:ai` → `vitnode i18n update-ai`: the script keeps its name. */
export const i18nCliCommand = (script: (typeof i18nCommands)[number]) =>
  `vitnode i18n ${script.slice("i18n:".length).replace(":", "-")}`;

const i18nScripts = Object.fromEntries(
  i18nCommands.map(command => [command, i18nCliCommand(command)]),
);

const runScript = (pm: string, script: string) =>
  pm === "npm" ? `npm run ${script} --` : `${pm} run ${script}`;

const i18nRootScripts = (pm: string, appDir: string) =>
  Object.fromEntries(
    i18nCommands.map(command => [
      command,
      `cd ${appDir} && ${runScript(pm, command)}`,
    ]),
  );

const dockerDevScript = (appName: string) =>
  `docker compose -f ./docker-compose.yml -p ${appName}-vitnode-dev up -d`;

/**
 * The root of a generated monorepo, and the one place its database is gated.
 *
 * `dev` runs the bootstrap to completion *before* Turbo starts anything, and
 * that ordering is the reason it is a `&&` at the root rather than a
 * `dependsOn` inside `turbo.json`: `dev` is a persistent task, Turbo starts
 * persistent tasks as soon as their dependencies are satisfied *per package*,
 * and a monorepo has two of them. Gating here is one sequence point for the
 * whole workspace - the schema is ready, then both runtimes start - instead of a
 * race whose outcome depends on which package Turbo happens to schedule first.
 *
 * `db:prepare` resolves to whichever package owns the schema (the API, or the
 * single app that mounts it); the web app of a split deployment declares no such
 * script, so nothing in this line makes the frontend own migrations.
 */
export const rootScripts = (
  enableEslint: boolean,
  enableDocker: boolean,
  appName: string,
  pm: string,
  i18nAppDir: string,
) => ({
  "db:migrate": "turbo db:migrate",
  "db:prepare": "turbo db:prepare",
  "build:plugins": "turbo build:plugins",
  dev: "turbo build:plugins && turbo db:prepare && turbo dev",
  build: "turbo build",
  start: "turbo start",
  ...i18nRootScripts(pm, i18nAppDir),
  ...withIf(enableEslint, {
    lint: "turbo lint",
    "lint:fix": "turbo lint:fix",
  }),
  ...withIf(enableDocker, { "docker:dev": dockerDevScript(appName) }),
});

/**
 * The API app, which owns the database in every shape that has one.
 *
 * `dev` gates on the bootstrap unconditionally, including inside a monorepo
 * whose root also gates. That redundancy is deliberate: `cd apps/api && pnpm dev`
 * and `turbo dev --filter=api` are both things people do, and neither goes
 * through the root script. An app that reads a schema is responsible for having
 * one.
 *
 * Running the bootstrap twice is safe *because* of `withMigrationLock`: the
 * second run waits for the first, then finds nothing pending. Without that lock
 * two gates in one monorepo race on `CREATE SCHEMA IF NOT EXISTS drizzle` and one
 * of them fails - measured, not theorised. See `@vitnode/core`'s
 * `scripts/prepare-database.ts`.
 */
export const apiScripts = (
  pm: string,
  eslint: boolean,
  docker: boolean,
  onlyApi: boolean,
  appName: string,
) => {
  return {
    "db:migrate": "vitnode migrate",
    "db:prepare": "vitnode db:prepare",
    // `vitnode` follows the project's runtime: on Bun it runs `bun --hot`
    // and starts `src/index.ts` directly, so there is nothing to build.
    dev: "vitnode dev",
    ...(pm === "bun" ? {} : { build: "vitnode build" }),
    start: "vitnode start",
    "dev:email": "email dev --dir src/emails",
    ...i18nScripts,
    ...withIf(eslint, eslintScripts),
    ...withIf(docker && onlyApi, { "docker:dev": dockerDevScript(appName) }),
    "drizzle-kit": "drizzle-kit",
  };
};

/**
 * The single app: a TanStack Start site with the Hono API mounted inside it.
 *
 * `dev`, `build` and `start` are the VitNode CLI, which drives Vite through its
 * JavaScript API and starts the plain Node entry a Start build emits
 * (`.output/server/index.mjs`) - nothing beyond Node is needed to run it.
 *
 * **This shape owns a database.** It ships `drizzle.config.ts`, a `migrations/`
 * directory and `vitnode.api.config.ts`, and it serves `/api/*` from its own
 * process - so it is the schema's owner as much as a standalone API app is, and
 * `vitnode dev` runs the database bootstrap before Vite starts.
 *
 * That line went missing in Stage 17 and it is the regression this file was
 * fixed for. The reasoning at the time was correct about the half it was looking
 * at: `init` also copied every installed plugin's pages into the host app, and a
 * plugin's routes are compiled into `src/plugin-routes.gen.ts` by the app's own
 * Vite plugin now - so the *plugin* half of `init` really had nothing left to
 * do. But
 * `init` had a second responsibility nobody was auditing, and dropping the whole
 * command dropped it too: apply pending migrations and seed the roles,
 * languages and permissions a VitNode installation cannot answer a request
 * without. A fresh clone then started Vite against an empty database.
 *
 * `vitnode db:prepare` is that half, under a name that says only what it does.
 * It never touches a plugin page - see `@vitnode/core/framework/vite`.
 */
export const singleAppScripts = (
  eslint: boolean,
  docker: boolean,
  appName: string,
) => ({
  "db:migrate": "vitnode migrate",
  "db:prepare": "vitnode db:prepare",
  dev: "vitnode dev",
  "dev:email": "email dev --dir src/emails",
  build: "vitnode build",
  start: "vitnode start",
  ...i18nScripts,
  ...withIf(eslint, eslintScripts),
  ...withIf(docker, { "docker:dev": dockerDevScript(appName) }),
  "drizzle-kit": "drizzle-kit",
});

export const webScripts = (eslint: boolean) => ({
  dev: "vitnode dev",
  build: "vitnode build",
  start: "vitnode start",
  ...i18nScripts,
  ...withIf(eslint, eslintScripts),
});

/**
 * Dependency builders
 */
const baseDevDeps = (eslint: boolean, includePrettier: boolean) => ({
  "@types/node": versionsPackageJson.typesNode,
  "@vitnode/config": "", // filled with local version dynamically
  ...withIf(eslint, {
    eslint: versionsPackageJson.eslint,
    ...withIf(includePrettier, {
      prettier: versionsPackageJson.prettier,
      "prettier-plugin-tailwindcss": versionsPackageJson.prettierTailwind,
    }),
  }),
});

const rootDevDeps = (eslint: boolean) => ({
  ...baseDevDeps(eslint, true),
  turbo: versionsPackageJson.turbo,
  typescript: versionsPackageJson.typescript,
  zod: versionsPackageJson.zod,
});

const apiDeps = {
  "@hono/zod-openapi": versionsPackageJson.honoZodOpenapi,
  "@hono/zod-validator": versionsPackageJson.honoZodValidator,
  "@vitnode/core": "", // filled dynamically
  "drizzle-kit": versionsPackageJson.drizzleKit,
  "drizzle-orm": versionsPackageJson.drizzleOrm,
  hono: versionsPackageJson.hono,
  react: versionsPackageJson.react,
  "react-dom": versionsPackageJson.reactDom,
  "react-email": versionsPackageJson.reactEmail,
  ws: versionsPackageJson.ws,
  zod: versionsPackageJson.zod,
};

const apiDevDeps = (pm: string, eslint: boolean) => ({
  "@hono/node-server": "^2.0",
  "@react-email/ui": versionsPackageJson.reactEmailUi,
  ...(pm === "bun" ? { "@types/bun": versionsPackageJson.typesBun } : {}),
  "@types/node": versionsPackageJson.typesNode,
  "@types/react": versionsPackageJson.typesReact,
  "@types/react-dom": versionsPackageJson.typesReactDom,
  cn: versionsPackageJson.cn,
  "@vitnode/config": "",
  dotenv: versionsPackageJson.dotenv,
  ...withIf(eslint, {
    eslint: versionsPackageJson.eslint,
    // Prettier in API only when onlyApi + eslint in original code – we'll preserve by passing include later if needed
  }),
  "tsc-alias": versionsPackageJson.tscAlias,
  tsx: versionsPackageJson.tsx,
  typescript: versionsPackageJson.typescript,
});

const tanstackWebDeps = {
  "@tailwindcss/vite": versionsPackageJson.tailwindVite,
  "@tanstack/react-form": versionsPackageJson.tanstackReactForm,
  "@tanstack/react-query": versionsPackageJson.tanstackReactQuery,
  "@tanstack/react-router": versionsPackageJson.tanstackReactRouter,
  "@tanstack/react-router-ssr-query":
    versionsPackageJson.tanstackRouterSsrQuery,
  "@tanstack/react-start": versionsPackageJson.tanstackReactStart,
  "@vitnode/core": "",
  "lucide-react": versionsPackageJson.lucide,
  nitro: versionsPackageJson.nitro,
  react: versionsPackageJson.react,
  "react-dom": versionsPackageJson.reactDom,
  sonner: versionsPackageJson.sonner,
  tailwindcss: versionsPackageJson.tailwind,
  tslib: versionsPackageJson.tslib,
  "use-intl": versionsPackageJson.useIntl,
  zod: versionsPackageJson.zod,
};

const singleAppDeps = {
  ...tanstackWebDeps,
  "@hono/zod-openapi": versionsPackageJson.honoZodOpenapi,
  "@hono/zod-validator": versionsPackageJson.honoZodValidator,
  "drizzle-kit": versionsPackageJson.drizzleKit,
  "drizzle-orm": versionsPackageJson.drizzleOrm,
  hono: versionsPackageJson.hono,
  "react-email": versionsPackageJson.reactEmail,
  shadcn: versionsPackageJson.shadcn,
};

const tanstackWebDevDeps = {
  "@tanstack/devtools-vite": versionsPackageJson.tanstackDevtoolsVite,
  "@tanstack/react-devtools": versionsPackageJson.tanstackReactDevtools,
  "@tanstack/react-query-devtools": versionsPackageJson.tanstackQueryDevtools,
  "@tanstack/react-router-devtools": versionsPackageJson.tanstackRouterDevtools,
  "@types/node": versionsPackageJson.typesNode,
  "@types/react": versionsPackageJson.typesReact,
  "@types/react-dom": versionsPackageJson.typesReactDom,
  cn: versionsPackageJson.cn,
  "@vitejs/plugin-react": versionsPackageJson.viteReact,
  "@vitnode/config": "",
  "tw-animate-css": versionsPackageJson.twAnimateCss,
  typescript: versionsPackageJson.typescript,
  vite: versionsPackageJson.vite,
};

const singleAppDevDeps = (eslint: boolean) => ({
  ...tanstackWebDevDeps,
  "@react-email/ui": versionsPackageJson.reactEmailUi,
  ...withIf(eslint, {
    eslint: versionsPackageJson.eslint,
    prettier: versionsPackageJson.prettier,
    "prettier-plugin-tailwindcss": versionsPackageJson.prettierTailwind,
  }),
  turbo: versionsPackageJson.turbo,
});

const webDeps = {
  ...tanstackWebDeps,
  shadcn: versionsPackageJson.shadcn,
};

const webDevDeps = (eslint: boolean) => ({
  ...tanstackWebDevDeps,
  "class-variance-authority": versionsPackageJson.cva,
  ...withIf(eslint, { eslint: versionsPackageJson.eslint }),
});

/**
 * Main
 */
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
  mode: Mode;
  monorepo?: boolean;
  packageManager: string;
  root: string;
}) => {
  const vitnodeVersionRange = await getVitnodePackageVersion();
  const pmVersions = await getAvailablePackageManagers();
  const pmSpec = `${packageManager}@${pmVersions[packageManager]}`;
  const p = paths(root);

  const isApiMonorepo = mode === "apiMonorepo" || !!monorepo;
  const isOnlyApi = mode === "onlyApi";
  const isSingleApp = mode === "singleApp";

  // 1) Root package.json (for monorepo/apiMonorepo)
  if (isApiMonorepo) {
    const rootPkg: PackageJSON = {
      name: appName,
      private: true,
      scripts: rootScripts(
        eslint,
        !!docker,
        appName,
        packageManager,
        isSingleApp ? "apps/web" : "apps/api",
      ),
      devDependencies: {
        ...rootDevDeps(eslint),
        "@vitnode/config": vitnodeVersionRange,
      },
      packageManager: pmSpec,
      workspaces: ["apps/*", "plugins/*"],
    };

    await writeJson(join(p.root, "package.json"), rootPkg);
  }

  // 2) API package.json (shared by onlyApi and apiMonorepo)
  const apiPkg: PackageJSON = {
    name: isApiMonorepo ? "api" : appName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: apiScripts(
      packageManager,
      eslint,
      !!docker,
      mode === "onlyApi",
      appName,
    ),
    dependencies: {
      ...apiDeps,
      "@vitnode/core": vitnodeVersionRange,
    },
    devDependencies: {
      ...apiDevDeps(packageManager, eslint),
      "@vitnode/config": vitnodeVersionRange,
      ...(eslint && mode === "onlyApi"
        ? {
            prettier: versionsPackageJson.prettier,
            "prettier-plugin-tailwindcss": versionsPackageJson.prettierTailwind,
          }
        : {}),
      // TS pipeline pieces when not using Bun for dev
      ...(packageManager === "bun" ? {} : {}),
    },
  };

  // 3) Single app (TanStack Start + the Hono API inside one app)
  if (isSingleApp) {
    const singlePkg: PackageJSON = {
      name: monorepo ? "web" : appName,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: singleAppScripts(eslint, !!docker, appName),
      dependencies: {
        ...singleAppDeps,
        "@vitnode/core": vitnodeVersionRange,
      },
      devDependencies: {
        ...singleAppDevDeps(eslint),
        "@vitnode/config": vitnodeVersionRange,
      },
      packageManager: pmSpec,
    };

    await writeJson(join(monorepo ? p.web : p.root, "package.json"), singlePkg);
  }

  // 4) apiMonorepo: write API + WEB
  if (mode === "apiMonorepo") {
    await writeJson(join(p.api, "package.json"), apiPkg);

    const webPkg: PackageJSON = {
      name: "web",
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: webScripts(eslint),
      dependencies: {
        ...webDeps,
        "@vitnode/core": vitnodeVersionRange,
      },
      devDependencies: {
        ...webDevDeps(eslint),
        "@vitnode/config": vitnodeVersionRange,
      },
    };

    await writeJson(join(p.web, "package.json"), webPkg);
  }

  // 5) onlyApi: write API (in root or in monorepo structure if requested)
  if (isOnlyApi) {
    await writeJson(join(monorepo ? p.api : p.root, "package.json"), apiPkg);
  }
};
