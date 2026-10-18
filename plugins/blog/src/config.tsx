import { buildPlugin } from "@vitnode/core/lib/plugin";

import messages from "./locales";
import { manifest } from "./manifest.gen";
import { routes } from "./routes";

/**
 * The blog's frontend half: its manifest, locale files and the public
 * `/blog/:slug` article page.
 *
 * Register it in the app's `src/vitnode.config.ts`, next to
 * `blogApiPlugin` in `src/vitnode.api.config.ts` - both read the same
 * `@vitnode/blog` manifest. The AdminCP sidebar entries and content forms are
 * not passed here: VitNode discovers them from the package's `admin/nav` and
 * `admin/content` exports when it generates the app's registries.
 *
 * @example
 * ```ts
 * // src/vitnode.config.ts
 * import { blogPlugin } from "@vitnode/blog/config";
 * import { buildConfig } from "@vitnode/core/vitnode.config";
 *
 * export const vitNodeConfig = buildConfig({
 *   // ...
 *   plugins: [blogPlugin()],
 * });
 * ```
 */
export const blogPlugin = () =>
  buildPlugin({
    manifest,
    localeFiles: {
      en: "@vitnode/blog/locales/en.json",
    },
    messages,
    routes,
  });
