import type { PackageJson } from "../project/packages";

import { pluginApiVariableName, pluginVariableName, titleOf } from "./naming";

export interface PluginTemplateInput {
  description: string;
  /** Short name: folder, route and the base of the variable names. */
  name: string;
  packageName: string;
  /** Versions for every dependency the template names. */
  versions: Record<string, string>;
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const pick = (versions: Record<string, string>, names: readonly string[]) =>
  Object.fromEntries(names.map(name => [name, versions[name] ?? "*"] as const));

/** Exactly what the repository's own plugins depend on - and nothing more. */
const DEPENDENCIES = [
  "@hono/zod-openapi",
  "@tanstack/react-form",
  "@vitnode/core",
  "drizzle-kit",
  "drizzle-orm",
  "hono",
  "react",
  "react-dom",
  "use-intl",
  "zod",
] as const;

const DEV_DEPENDENCIES = [
  "@swc/cli",
  "@swc/core",
  "@types/react",
  "@types/react-dom",
  "@vitnode/config",
  "eslint",
  "tsc-alias",
  "typescript",
  "vitest",
] as const;

export const pluginPackageJson = ({
  description,
  packageName,
  versions,
}: PluginTemplateInput): PackageJson & Record<string, unknown> => ({
  name: packageName,
  version: "0.1.0",
  description,
  private: true,
  type: "module",
  exports: {
    // Strings are copied, not compiled, so they are exported from source.
    "./locales/*.json": "./src/locales/*.json",
    "./*": {
      import: "./dist/src/*.js",
      types: "./dist/src/*.d.ts",
      default: "./dist/src/*.js",
    },
  },
  scripts: {
    "build:plugins": "vitnode build",
    dev: "vitnode dev",
    lint: "eslint .",
    "lint:fix": "eslint . --fix",
    test: "vitest run",
    "test:watch": "vitest",
  },
  dependencies: pick(versions, DEPENDENCIES),
  devDependencies: pick(versions, DEV_DEPENDENCIES),
});

const constTemplate = ({ packageName }: PluginTemplateInput) =>
  `export const CONFIG_PLUGIN = {
  pluginId: "${packageName}" as const,
};
`;

const routesTemplate = ({ name }: PluginTemplateInput) =>
  `import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";

import { CONFIG_PLUGIN } from "./const";

export const routes = definePluginRoutes([
  page("/${name}", {
    component: lazy(() => import("./pages/home-page")),
    messages: [\`\${CONFIG_PLUGIN.pluginId}.home\`],
  }),
]);
`;

const pageTemplate = ({ packageName }: PluginTemplateInput) =>
  `import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { definePluginRoute } from "@vitnode/core/routing";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useTranslations } from "use-intl";

import { CONFIG_PLUGIN } from "@/const";

interface HelloMessage {
  message: string;
}

export const route = definePluginRoute<HelloMessage>({
  load: async () => {
    const response = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "hello",
      path: "/",
    });

    return await response.json();
  },
});

const HomePage = ({ loaderData }: PluginRoutePageProps<HelloMessage>) => {
  const t = useTranslations("${packageName}");

  return (
    <main className="container mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {t("home.title")}
      </h1>

      <p className="text-muted-foreground leading-relaxed text-pretty">
        {t("home.desc")}
      </p>

      <section className="bg-card text-card-foreground flex flex-col gap-1 rounded-lg border p-4">
        <span className="text-muted-foreground text-sm">{t("home.api")}</span>
        <span className="font-medium">{loaderData.message}</span>
      </section>
    </main>
  );
};

export default HomePage;
`;

const messagesTemplate = ({ name, packageName }: PluginTemplateInput) =>
  json({
    [packageName]: {
      home: {
        api: "Your plugin's API answered:",
        desc: "This page ships inside the plugin and is served by every app that installs it.",
        title: `Hello from ${titleOf(name)}`,
      },
    },
  });

const messagesBarrelTemplate = () =>
  `import type { LocaleMessagesMap } from "@vitnode/core/lib/i18n/types";

const messages: LocaleMessagesMap = {
  en: async () => await import("./en.json", { with: { type: "json" } }),
};

export default messages;
`;

const configTemplate = ({ name, packageName }: PluginTemplateInput) =>
  `import { buildPlugin } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import messages from "./locales";
import { routes } from "./routes";

export const ${pluginVariableName(name)} = () =>
  buildPlugin({
    ...CONFIG_PLUGIN,
    localeFiles: {
      en: "${packageName}/locales/en.json",
    },
    messages,
    routes,
  });
`;

const apiRouteTemplate = () =>
  `import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";

import { CONFIG_PLUGIN } from "@/const";

export const helloRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ message: z.string() }),
          },
        },
        description: "A greeting from the plugin.",
      },
    },
  },
  handler: c => c.json({ message: \`Hello from \${CONFIG_PLUGIN.pluginId}!\` }),
});
`;

const apiModuleTemplate = () =>
  `import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import { helloRoute } from "./hello.route";

export const helloModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "hello",
  routes: [helloRoute],
});
`;

const apiModuleTestTemplate = ({ packageName }: PluginTemplateInput) =>
  `import { describe, expect, it } from "vitest";

import { helloModule } from "./hello.module";

describe("hello module", () => {
  it("answers GET / with a greeting from the plugin", async () => {
    const response = await helloModule.hono.request("/");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Hello from ${packageName}!",
    });
  });
});
`;

const apiConfigTemplate = ({ name }: PluginTemplateInput) =>
  `import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { helloModule } from "@/api/modules/hello/hello.module";
import { CONFIG_PLUGIN } from "@/const";

export const ${pluginApiVariableName(name)} = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    modules: [helloModule],
  });

/** What an app's generated api-registry.gen.ts imports to type this plugin's routes. */
export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof ${pluginApiVariableName(name)}>
>;
`;

const globalTypesTemplate = () =>
  `/// <reference types="use-intl" />

import core from "@vitnode/core/locales/en.json" with { type: "json" };
import plugin from "./src/locales/en.json" with { type: "json" };

declare module "use-intl" {
  interface AppConfig {
    Messages: typeof plugin & typeof core;
  }
}
`;

const readmeTemplate = ({
  description,
  name,
  packageName,
}: PluginTemplateInput) =>
  `# ${titleOf(name)}

${description}

A VitNode plugin. It adds a page at \`/${name}\`, served from \`src/pages/home-page.tsx\`, which loads its text from the plugin's own API (\`GET /api/${packageName}/hello\`).

## Develop

\`\`\`bash
vitnode dev       # rebuild dist/ on every change
vitnode build     # one-off build
vitnode plugin validate ${name}
\`\`\`

Docs: https://vitnode.com/docs/dev/plugins
`;

const TSCONFIG = {
  $schema: "https://json.schemastore.org/tsconfig",
  extends: "@vitnode/config/tsconfig",
  compilerOptions: {
    target: "ESNext",
    module: "esnext",
    moduleResolution: "bundler",
    rootDir: "./",
    outDir: "./dist",
    incremental: false,
    jsx: "react-jsx",
    emitDeclarationOnly: true,
    declaration: true,
    declarationMap: true,
    paths: { "@/*": ["./src/*"] },
  },
  exclude: ["node_modules"],
  include: ["types", "src", "global.d.ts", "vitest.config.ts"],
};

const TSCONFIG_BUILD = {
  $schema: "https://json.schemastore.org/tsconfig",
  extends: "./tsconfig.json",
  exclude: [
    "node_modules",
    "vitest.config.ts",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.test-d.ts",
  ],
};

const SWCRC = {
  $schema: "https://swc.rs/schema.json",
  exclude: ["\\.test\\.tsx?$", "\\.test-d\\.ts$", "^src/tests/"],
  minify: true,
  jsc: {
    baseUrl: "./",
    target: "esnext",
    paths: { "@/*": ["./src/*"] },
    parser: { syntax: "typescript", tsx: true },
    transform: { react: { runtime: "automatic" } },
  },
  module: { type: "nodenext", strict: true, resolveFully: true },
};

const NPMIGNORE = `/src/*
!/src/locales
!/src/locales/**

/node_modules
/.turbo
/.swcrc
/global.d.ts
/types
/tsconfig.json
/tsconfig.build.json
/vitest.config.ts
`;

const VITEST_CONFIG = `import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
`;

const ESLINT_CONFIG = `import eslintVitNode from "@vitnode/config/eslint";
import eslintVitNodeReact from "@vitnode/config/eslint.react";

export default [
  ...eslintVitNode,
  ...eslintVitNodeReact,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
`;

export type TemplateGroup =
  | "definition"
  | "documentation"
  | "package"
  | "structure"
  | "tests"
  | "translations";

export interface TemplateFile {
  content: string;
  group: TemplateGroup;
  path: string;
}

/**
 * The canonical VitNode plugin: one page, one API endpoint feeding it, its
 * strings, and a test of the endpoint - the smallest plugin that exercises
 * every layer, with the same structure and build setup as the plugins in
 * VitNode's own repository.
 */
export const pluginTemplate = (input: PluginTemplateInput): TemplateFile[] => [
  {
    content: json(pluginPackageJson(input)),
    group: "package",
    path: "package.json",
  },
  { content: json(TSCONFIG), group: "package", path: "tsconfig.json" },
  {
    content: json(TSCONFIG_BUILD),
    group: "package",
    path: "tsconfig.build.json",
  },
  { content: json(SWCRC), group: "package", path: ".swcrc" },
  { content: NPMIGNORE, group: "package", path: ".npmignore" },
  { content: ESLINT_CONFIG, group: "package", path: "eslint.config.mjs" },
  { content: globalTypesTemplate(), group: "package", path: "global.d.ts" },
  { content: constTemplate(input), group: "definition", path: "src/const.ts" },
  {
    content: configTemplate(input),
    group: "definition",
    path: "src/config.tsx",
  },
  {
    content: apiConfigTemplate(input),
    group: "definition",
    path: "src/config.api.ts",
  },
  { content: routesTemplate(input), group: "structure", path: "src/routes.ts" },
  {
    content: pageTemplate(input),
    group: "structure",
    path: "src/pages/home-page.tsx",
  },
  {
    content: apiModuleTemplate(),
    group: "structure",
    path: "src/api/modules/hello/hello.module.ts",
  },
  {
    content: apiRouteTemplate(),
    group: "structure",
    path: "src/api/modules/hello/hello.route.ts",
  },
  {
    content: messagesTemplate(input),
    group: "translations",
    path: "src/locales/en.json",
  },
  {
    content: messagesBarrelTemplate(),
    group: "translations",
    path: "src/locales/index.ts",
  },
  { content: VITEST_CONFIG, group: "tests", path: "vitest.config.ts" },
  {
    content: apiModuleTestTemplate(input),
    group: "tests",
    path: "src/api/modules/hello/hello.module.test.ts",
  },
  { content: readmeTemplate(input), group: "documentation", path: "README.md" },
];
