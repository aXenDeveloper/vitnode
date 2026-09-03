import { buildConfig } from "@vitnode/core/vitnode.config";

import { appMessages } from "./locales/app";
import { vitNodeShellConfig } from "./vitnode.shell.config";

/**
 * This app's frontend config, in the shape every VitNode app builds it.
 *
 * `plugins` is empty, and a plugin is added here by id and translations rather
 * than through its own `blogPlugin()` entry:
 *
 *     import { buildPlugin } from '@vitnode/core/lib/plugin'
 *     import { CONFIG_PLUGIN as BLOG } from '@acme/blog/const'
 *
 *     import { packageMessages } from './locales/packages'
 *
 *     plugins: [
 *       buildPlugin({
 *         messages: packageMessages[BLOG.pluginId],
 *         pluginId: BLOG.pluginId,
 *       }),
 *     ]
 *
 * That is a *scope* decision rather than a compatibility one. This object's one
 * reader takes `pluginId` and `messages` off each plugin and nothing else, so a
 * full registration would add every content type's editing screen to a
 * server-only graph where nothing would ever look at them. The AdminCP gets its
 * content types from `src/content-registry.gen.ts` instead - one literal import
 * per configured plugin - so a browser loads them with the content route and not
 * before.
 *
 * The same split, one layer up, feeds the sidebar: `src/admin-nav.gen.ts` is the
 * navigation half - ids, hrefs, permissions, icons - and nothing that renders a
 * screen. See `src/lib/admin-nav.ts` and `src/lib/content-registry.ts`; both
 * explain why they are generated rather than read from here.
 *
 * A plugin's *pages* need nothing in this file at all. It declares them in its
 * own `src/routes.ts`, and this app's Vite build compiles them into
 * `src/plugin-routes.gen.ts`, which `src/router.tsx` mounts under the shell the
 * plugin's `area` names. No page is ever copied into `src/routes`.
 *
 * Server-side only, and deliberately so - see `vitnode.shell.config.ts`.
 * `src/server/messages.server.ts` is the only importer, and it carries the
 * `server-only` guard that keeps it that way.
 *
 * `buildConfig` also registers this object process-wide, which is how core's own
 * route files find it without being handed it as a prop.
 */
export const vitNodeConfig = buildConfig({
  ...vitNodeShellConfig,
  /**
   * The shell's locale declaration, plus the message loaders that must not be in
   * it: `src/i18n.ts` is spread into the browser-facing shell config, and these
   * are functions.
   */
  i18n: { ...vitNodeShellConfig.i18n, messages: appMessages },
  plugins: [],
});
