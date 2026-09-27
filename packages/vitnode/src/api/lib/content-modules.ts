import { createRequire } from "node:module";
import { join } from "node:path";

import type { ContentUrlDefinition } from "@/content/public-urls";

import {
  assertContentModuleCovers,
  CONTENT_URLS_ERROR_PREFIX,
  contentModuleSpecifier,
  ContentUrlError,
} from "@/content/public-urls";

export interface ContentModuleLoader {
  describe: string;
  load: (pluginId: string) => unknown;
}

export const generatedContentModules = (
  modules: Readonly<Record<string, unknown>>,
): ContentModuleLoader => ({
  describe:
    "the web build's `src/content-modules.gen.ts` (a plugin is listed there only when the app's `vitnode.config.ts` configures it and the build can resolve its `./content` export)",
  load: pluginId => modules[pluginId],
});

const REQUIRE_ESM_ERRORS = new Set([
  "ERR_REQUIRE_ASYNC_MODULE",
  "ERR_REQUIRE_ESM",
]);

const errorCode = (error: unknown): string | undefined =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string"
    ? error.code
    : undefined;

export const packageContentModules = (
  root: string = process.cwd(),
): ContentModuleLoader => {
  const requireFromRoot = createRequire(join(root, "package.json"));

  return {
    describe: `package resolution from "${root}", the same exports lookup a web build does`,
    load: pluginId => {
      const specifier = contentModuleSpecifier(pluginId);
      let file: string;

      try {
        file = requireFromRoot.resolve(specifier);
      } catch {
        return undefined;
      }

      try {
        return requireFromRoot(file) as unknown;
      } catch (error) {
        const code = errorCode(error);
        if (code === undefined || !REQUIRE_ESM_ERRORS.has(code)) throw error;

        throw new ContentUrlError(
          `${CONTENT_URLS_ERROR_PREFIX} "${specifier}" resolved to "${file}", but this Node.js cannot load an ES module synchronously (${code}). Run Node.js 22.12 or newer, and keep top-level \`await\` out of the content module.`,
          { code: "invalid-content-types-module", pluginId },
        );
      }
    },
  };
};

export const assertPluginContentModules = ({
  loader,
  plugins,
}: {
  loader: ContentModuleLoader;
  plugins: readonly {
    pluginId: string;
    publicContentTypes?: readonly ContentUrlDefinition[];
  }[];
}): void => {
  for (const { pluginId, publicContentTypes = [] } of plugins) {
    if (publicContentTypes.length === 0) continue;

    assertContentModuleCovers({
      loaded: loader.load(pluginId),
      loadedFrom: loader.describe,
      pluginId,
      published: publicContentTypes,
    });
  }
};
