import { createRequire } from "node:module";
import { join } from "node:path";

import type { ContentUrlDefinition } from "@/content/public-urls";

import {
  assertContentModuleCovers,
  CONTENT_URLS_ERROR_PREFIX,
  contentModuleSpecifier,
  ContentUrlError,
} from "@/content/public-urls";

/**
 * Where an API process finds each plugin's browser-safe `{pluginId}/content`
 * module - the one exporting `contentTypes` - to check it against the content
 * types the plugin's API publishes.
 */
export interface ContentModuleLoader {
  /** Where modules are looked up, for error messages. */
  describe: string;
  /** The plugin's content module, or `undefined` when there is none. */
  load: (pluginId: string) => unknown;
}

/**
 * A {@link ContentModuleLoader} that wraps the `contentModules` record (the
 * app's generated `src/content-modules.gen.ts`) passed to `buildApiConfig`, in
 * an app whose API runs inside the web build. `VitNodeAPI` applies it.
 */
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

/**
 * A {@link ContentModuleLoader} that resolves `{pluginId}/content` from the
 * packages installed under `root` (the working directory by default) - the
 * fallback for a standalone API without generated content modules. Server-only.
 *
 * Its `load` throws a `ContentUrlError` when the module resolves but this
 * Node.js cannot `require()` it (before 22.12, or with top-level `await`), and
 * rethrows any other error the module raises while loading.
 */
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

/**
 * Checks, at API startup, that every plugin publishing content types with
 * public URLs also exports those content types, with the same public URLs,
 * from its `./content` module - which is how the web build verifies a page
 * serves each URL. Extra exported types are allowed.
 *
 * @throws A `ContentUrlError` when a plugin's content module is missing, has
 * no valid `contentTypes` export, or omits a published type or exports it with
 * different URLs. Loader errors propagate.
 */
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
