import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import type { PackageJSON } from "../helpers/packages-json.js";
import type { CreateCliReturn } from "../questions.js";

import { getAvailablePackageManagers } from "../helpers/get-available-package-managers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type Mode = CreateCliReturn["mode"];

const writeJson = async (path: string, data: unknown) =>
  writeFile(path, JSON.stringify(data, null, 2));

const paths = (root: string) => ({
  root,
  api: join(root, "apps", "api"),
  web: join(root, "apps", "web"),
});

const withIf = <T extends Record<string, string>>(cond: boolean, obj: T) =>
  (cond ? obj : {}) as Partial<T>;

const versions = {
  typesNode: "^24",
  typesReact: "^19.2",
  typesReactDom: "^19.2",
  typesBun: "latest",

  turbo: "^2.5",
  typescript: "^5.9",
  tsx: "^4.20.6",
  tscAlias: "^1.8.16",
  eslint: "^9.39.1",
  prettier: "^3.6.2",
  prettierTailwind: "^0.6.14",
  tailwind: "^4.1.17",
  tailwindPostcss: "^4.1.17",
  postcss: "^8.5.6",
  twAnimateCss: "^1.4.0",

  react: "^19.2",
  reactDom: "^19.2",
  nextSingle: "^16.0.1",
  nextWebInMonorepo: "^15.4.6",
  nextIntl: "^4.5.0",
  useIntl: "^4.5.0",
  rhf: "^7.66.0",
  rhfResolvers: "^5.1.1",
  lucide: "^0.553.0",
  sonner: "^2.0.7",
  dotenv: "^17.2.2",

  drizzleKit: "^0.31.6",
  drizzleOrm: "^0.44.7",

  hono: "^4.10.4",
  honoZodOpenapi: "^1.1.4",
  honoZodValidator: "^0.7.4",
  reactEmail: "^5.0.1",
  reactEmailComponents: "^1.0.0",
  zod: "^4.1.12",

  cva: "^0.7.1",
  babelPluginReactCompiler: "^1.0.0",
};

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
  "@types/node": versions.typesNode,
  "@vitnode/config": "", // filled with local version dynamically
  ...withIf(eslint, {
    eslint: versions.eslint,
    ...withIf(includePrettier, {
      prettier: versions.prettier,
      "prettier-plugin-tailwindcss": versions.prettierTailwind,
    }),
  }),
});

const rootDevDeps = (eslint: boolean) => ({
  ...baseDevDeps(eslint, true),
  turbo: versions.turbo,
  typescript: versions.typescript,
  zod: versions.zod,
});

const apiDeps = {
  "@hono/zod-openapi": versions.honoZodOpenapi,
  "@hono/zod-validator": versions.honoZodValidator,
  "@react-email/components": versions.reactEmailComponents,
  "@vitnode/core": "", // filled dynamically
  "drizzle-kit": versions.drizzleKit,
  "drizzle-orm": versions.drizzleOrm,
  hono: versions.hono,
  "next-intl": versions.nextIntl,
  react: versions.react,
  "react-dom": versions.reactDom,
  "use-intl": versions.useIntl,
  zod: versions.zod,
};

const apiDevDeps = (pm: string, eslint: boolean) => ({
  "@hono/node-server": "^1.19",
  ...(pm === "bun" ? { "@types/bun": versions.typesBun } : {}),
  "@types/node": versions.typesNode,
  "@types/react": versions.typesReact,
  "@types/react-dom": versions.typesReactDom,
  "@vitnode/config": "",
  dotenv: versions.dotenv,
  ...withIf(eslint, {
    eslint: versions.eslint,
    // Prettier in API only when onlyApi + eslint in original code – we'll preserve by passing include later if needed
  }),
  "react-email": versions.reactEmail,
  "tsc-alias": versions.tscAlias,
  tsx: versions.tsx,
  typescript: versions.typescript,
});

const singleAppDeps = {
  "@hono/zod-openapi": versions.honoZodOpenapi,
  "@hono/zod-validator": versions.honoZodValidator,
  "@hookform/resolvers": versions.rhfResolvers,
  "@react-email/components": versions.reactEmailComponents,
  "@vitnode/core": "",
  "drizzle-kit": versions.drizzleKit,
  "drizzle-orm": versions.drizzleOrm,
  hono: versions.hono,
  "lucide-react": versions.lucide,
  next: versions.nextSingle,
  "next-intl": versions.nextIntl,
  react: versions.react,
  "react-dom": versions.reactDom,
  "react-hook-form": versions.rhf,
  sonner: versions.sonner,
  "use-intl": versions.useIntl,
  zod: versions.zod,
};

const singleAppDevDeps = (eslint: boolean) => ({
  "@tailwindcss/postcss": versions.tailwindPostcss,
  "@types/node": versions.typesNode,
  "@types/react": versions.typesReact,
  "@types/react-dom": versions.typesReactDom,
  "@vitnode/config": "",
  "babel-plugin-react-compiler": versions.babelPluginReactCompiler,
  ...withIf(eslint, {
    eslint: versions.eslint,
    prettier: versions.prettier,
    "prettier-plugin-tailwindcss": versions.prettierTailwind,
  }),
  "react-email": versions.reactEmail,
  turbo: versions.turbo,
  tailwindcss: versions.tailwind,
  "tw-animate-css": versions.twAnimateCss,
  typescript: versions.typescript,
});

const webDeps = {
  "@vitnode/core": "",
  "lucide-react": versions.lucide,
  next: versions.nextWebInMonorepo,
  "next-intl": versions.nextIntl,
  react: versions.react,
  "react-dom": versions.reactDom,
  "react-hook-form": versions.rhf,
  sonner: versions.sonner,
};

const webDevDeps = (eslint: boolean) => ({
  "@hookform/resolvers": versions.rhfResolvers,
  "@tailwindcss/postcss": versions.tailwindPostcss,
  "@types/node": versions.typesNode,
  "@types/react": versions.typesReact,
  "@types/react-dom": versions.typesReactDom,
  "@vitnode/config": "",
  "babel-plugin-react-compiler": versions.babelPluginReactCompiler,
  "class-variance-authority": versions.cva,
  ...withIf(eslint, { eslint: versions.eslint }),
  postcss: versions.postcss,
  tailwindcss: versions.tailwind,
  "tw-animate-css": versions.twAnimateCss,
  typescript: versions.typescript,
  zod: versions.zod,
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
  // Resolve local version of @vitnode/* based on this CLI's package.json
  const cliPkg: PackageJSON = JSON.parse(
    await readFile(join(__dirname, "..", "..", "..", "package.json"), "utf-8"),
  );
  const vitnodeVersionRange = `^${cliPkg.version}`;

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
            prettier: versions.prettier,
            "prettier-plugin-tailwindcss": versions.prettierTailwind,
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
