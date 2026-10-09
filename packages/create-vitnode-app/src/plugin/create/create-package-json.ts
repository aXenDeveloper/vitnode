import { writeFile } from "fs/promises";

import type { PackageJSON } from "../../helpers/packages-json.js";

import { versionsPackageJson } from "../../create/package-versions.js";
import { getVitnodePackageVersion } from "../../helpers/get-vitnode-package-version.js";
import { withIf } from "../../helpers/with-If.js";
import { pluginPackageExports } from "./route-templates.js";

const writeJson = async (path: string, data: unknown) =>
  writeFile(path, JSON.stringify(data, null, 2));

export const pluginScripts = (oxlint: boolean) => ({
  "build:plugins": "vitnode build",
  dev: "vitnode dev",
  test: "vitest run",
  "test:watch": "vitest",
  ...withIf(oxlint, {
    lint: "oxlint --type-aware",
    "lint:fix": "oxlint --type-aware --fix",
  }),
});

export const createPluginPackageJSON = async ({
  pluginName,
  pluginPath,
  oxlint,
}: {
  oxlint: boolean;
  pluginName: string;
  pluginPath: string;
}) => {
  const vitnodeVersionRange = await getVitnodePackageVersion();

  const pluginPkg: PackageJSON = {
    name: pluginName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: pluginScripts(oxlint),
    exports: pluginPackageExports(),
    dependencies: {
      "@hono/zod-openapi": versionsPackageJson.honoZodOpenapi,
      "@tanstack/react-form": versionsPackageJson.tanstackReactForm,
      "@vitnode/core": vitnodeVersionRange,
      "drizzle-kit": versionsPackageJson.drizzleKit,
      "drizzle-orm": versionsPackageJson.drizzleOrm,
      hono: versionsPackageJson.hono,
      "lucide-react": versionsPackageJson.lucide,
      react: versionsPackageJson.react,
      "react-dom": versionsPackageJson.reactDom,
      "react-email": versionsPackageJson.reactEmail,
      sonner: versionsPackageJson.sonner,
      "use-intl": versionsPackageJson.useIntl,
      zod: versionsPackageJson.zod,
    },
    devDependencies: {
      "@react-email/ui": versionsPackageJson.reactEmailUi,
      "@types/react": versionsPackageJson.typesReact,
      "@types/react-dom": versionsPackageJson.typesReactDom,
      "@vitnode/config": vitnodeVersionRange,
      cn: versionsPackageJson.cn,
      ...withIf(oxlint, {
        oxlint: versionsPackageJson.oxlint,
        "oxlint-tsgolint": versionsPackageJson.oxlintTsgolint,
      }),
      tsdown: versionsPackageJson.tsdown,
      typescript: versionsPackageJson.typescript,
      vitest: versionsPackageJson.vitest,
    },
  };

  await writeJson(`${pluginPath}/package.json`, pluginPkg);
};
