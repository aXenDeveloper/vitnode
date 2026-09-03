import { writeFile } from "fs/promises";

import type { PackageJSON } from "../../helpers/packages-json.js";

import { versionsPackageJson } from "../../create/package-versions.js";
import { getVitnodePackageVersion } from "../../helpers/get-vitnode-package-version.js";
import { withIf } from "../../helpers/with-If.js";
import { pluginPackageExports } from "./route-templates.js";

const writeJson = async (path: string, data: unknown) =>
  writeFile(path, JSON.stringify(data, null, 2));

export const createPluginPackageJSON = async ({
  pluginName,
  pluginPath,
  eslint,
}: {
  eslint: boolean;
  pluginName: string;
  pluginPath: string;
}) => {
  const vitnodeVersionRange = await getVitnodePackageVersion();

  const pluginPkg: PackageJSON = {
    name: pluginName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      "build:plugins": "vitnode build",
      dev: "vitnode dev",
      "dev:email": "email dev --dir src/emails",
      ...withIf(eslint, {
        lint: "turbo lint",
        "lint:fix": "turbo lint:fix",
      }),
    },
    exports: pluginPackageExports(),
    dependencies: {
      "@hono/zod-openapi": versionsPackageJson.honoZodOpenapi,
      "@vitnode/core": vitnodeVersionRange,
      "drizzle-kit": versionsPackageJson.drizzleKit,
      "drizzle-orm": versionsPackageJson.drizzleOrm,
      hono: versionsPackageJson.hono,
      "lucide-react": versionsPackageJson.lucide,
      react: versionsPackageJson.react,
      "react-dom": versionsPackageJson.reactDom,
      "react-email": versionsPackageJson.reactEmail,
      "react-hook-form": versionsPackageJson.rhf,
      sonner: versionsPackageJson.sonner,
      "use-intl": versionsPackageJson.useIntl,
      zod: versionsPackageJson.zod,
    },
    devDependencies: {
      "@react-email/ui": versionsPackageJson.reactEmailUi,
      "@swc/cli": versionsPackageJson.swcCli,
      "@swc/core": versionsPackageJson.swcCore,
      "@types/react": versionsPackageJson.typesReact,
      "@types/react-dom": versionsPackageJson.typesReactDom,
      "@vitnode/config": vitnodeVersionRange,
      ...withIf(eslint, {
        eslint: versionsPackageJson.eslint,
      }),
      "tsc-alias": versionsPackageJson.tscAlias,
      typescript: versionsPackageJson.typescript,
    },
  };

  await writeJson(`${pluginPath}/package.json`, pluginPkg);
};
