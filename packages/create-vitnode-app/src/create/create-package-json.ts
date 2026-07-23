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

const dockerDevScript = (appName: string) =>
  `docker compose -f ./docker-compose.yml -p ${appName}-vitnode-dev up -d`;

const rootScripts = (
  enableEslint: boolean,
  enableDocker: boolean,
  appName: string,
) => ({
  "db:migrate": "turbo db:migrate",
  init: "turbo init",
  dev: "turbo dev",
  build: "turbo build",
  start: "turbo start",
  ...withIf(enableEslint, {
    lint: "turbo lint",
    "lint:fix": "turbo lint:fix",
  }),
  ...withIf(enableDocker, { "docker:dev": dockerDevScript(appName) }),
});

const apiScripts = (
  pm: string,
  eslint: boolean,
  docker: boolean,
  onlyApi: boolean,
  appName: string,
) => ({
  "db:migrate": "vitnode migrate",
  init: "vitnode init --api",
  ...(pm === "bun"
    ? {
        dev: "vitnode init --api && bun run --hot src/index.ts",
        start: "NODE_ENV=production bun run src/index.ts",
      }
    : {
        dev: "vitnode init --api && tsx watch src/index.ts",
        build: "tsc && tsc-alias -p tsconfig.json",
        start: "node dist/index.js",
      }),
  "dev:email": "email dev --dir src/emails",
  ...withIf(eslint, eslintScripts),
  ...withIf(docker && onlyApi, { "docker:dev": dockerDevScript(appName) }),
  "drizzle-kit": "drizzle-kit",
});

const singleAppScripts = (
  eslint: boolean,
  docker: boolean,
  appName: string,
) => ({
  "db:migrate": "vitnode migrate",
  init: "vitnode init",
  dev: "vitnode init && next dev",
  "dev:email": "email dev --dir src/emails",
  build: "next build",
  start: "next start",
  ...withIf(eslint, eslintScripts),
  ...withIf(docker, { "docker:dev": dockerDevScript(appName) }),
  "drizzle-kit": "drizzle-kit",
});

const webScripts = (eslint: boolean) => ({
  init: "vitnode init --web",
  dev: "vitnode init --web && next dev",
  build: "next build",
  start: "next start",
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
  "next-intl": versionsPackageJson.nextIntl,
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

const singleAppDeps = {
  "@hono/zod-openapi": versionsPackageJson.honoZodOpenapi,
  "@hono/zod-validator": versionsPackageJson.honoZodValidator,
  "@hookform/resolvers": versionsPackageJson.rhfResolvers,
  "@vitnode/core": "",
  "drizzle-kit": versionsPackageJson.drizzleKit,
  "drizzle-orm": versionsPackageJson.drizzleOrm,
  hono: versionsPackageJson.hono,
  "lucide-react": versionsPackageJson.lucide,
  next: versionsPackageJson.nextSingle,
  "next-intl": versionsPackageJson.nextIntl,
  react: versionsPackageJson.react,
  "react-dom": versionsPackageJson.reactDom,
  "react-email": versionsPackageJson.reactEmail,
  "react-hook-form": versionsPackageJson.rhf,
  sonner: versionsPackageJson.sonner,
  zod: versionsPackageJson.zod,
};

const singleAppDevDeps = (eslint: boolean) => ({
  "@react-email/ui": versionsPackageJson.reactEmailUi,
  "@tailwindcss/postcss": versionsPackageJson.tailwindPostcss,
  "@types/node": versionsPackageJson.typesNode,
  "@types/react": versionsPackageJson.typesReact,
  "@types/react-dom": versionsPackageJson.typesReactDom,
  "@vitnode/config": "",
  "babel-plugin-react-compiler": versionsPackageJson.babelPluginReactCompiler,
  ...withIf(eslint, {
    eslint: versionsPackageJson.eslint,
    prettier: versionsPackageJson.prettier,
    "prettier-plugin-tailwindcss": versionsPackageJson.prettierTailwind,
  }),
  turbo: versionsPackageJson.turbo,
  tailwindcss: versionsPackageJson.tailwind,
  "tw-animate-css": versionsPackageJson.twAnimateCss,
  typescript: versionsPackageJson.typescript,
});

const webDeps = {
  "@vitnode/core": "",
  "lucide-react": versionsPackageJson.lucide,
  next: versionsPackageJson.nextSingle,
  "next-intl": versionsPackageJson.nextIntl,
  react: versionsPackageJson.react,
  "react-dom": versionsPackageJson.reactDom,
  "react-hook-form": versionsPackageJson.rhf,
  sonner: versionsPackageJson.sonner,
};

const webDevDeps = (eslint: boolean) => ({
  "@hookform/resolvers": versionsPackageJson.rhfResolvers,
  "@tailwindcss/postcss": versionsPackageJson.tailwindPostcss,
  "@types/node": versionsPackageJson.typesNode,
  "@types/react": versionsPackageJson.typesReact,
  "@types/react-dom": versionsPackageJson.typesReactDom,
  "@vitnode/config": "",
  "babel-plugin-react-compiler": versionsPackageJson.babelPluginReactCompiler,
  "class-variance-authority": versionsPackageJson.cva,
  ...withIf(eslint, { eslint: versionsPackageJson.eslint }),
  postcss: versionsPackageJson.postcss,
  tailwindcss: versionsPackageJson.tailwind,
  "tw-animate-css": versionsPackageJson.twAnimateCss,
  typescript: versionsPackageJson.typescript,
  zod: versionsPackageJson.zod,
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
      scripts: rootScripts(eslint, !!docker, appName),
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

  // 3) Single app (Next.js + API inside one app)
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
