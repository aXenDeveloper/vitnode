import { CONFIG_PLUGIN as BLOG } from '@vitnode/blog/const'
import { buildPlugin } from '@vitnode/core/lib/plugin'
import { buildConfig } from '@vitnode/core/vitnode.config'
import { CONFIG_PLUGIN as EXAMPLE } from '@vitnode/example/const'

import { appMessages } from './locales/app'
import { packageMessages } from './locales/packages'
import { vitNodeShellConfig } from './vitnode.shell.config'

/**
 * This app's frontend config, in the shape every VitNode app builds it.
 *
 * The plugins are registered by id and translations, not through their own
 * `blogPlugin()` / `examplePlugin()` entries. That is now a *scope* decision
 * rather than a compatibility one, and the difference is worth stating because
 * the old reason is gone: until Stage 13 those entries reached a Tiptap editor
 * field, a form layout and a table cell that pulled in `next/dynamic`, so
 * importing one here was impossible. It no longer is - a plugin's whole frontend
 * registration is Next-free, and `src/tests/isolation.test.ts` asserts it.
 *
 * They still are not imported here, because of what this object is actually read
 * for: its one reader takes `pluginId` and `messages` off each plugin and
 * nothing else. A full registration would add every content type's editing
 * screen to that server-only graph, where nothing would ever look at them: the
 * AdminCP gets its content types from
 * `src/content-registry.gen.ts` instead, one literal import per configured
 * plugin, so a browser loads them with the content route and not before.
 *
 * The same split, one layer up, feeds the sidebar. `src/admin-nav.gen.ts` is the
 * navigation half - ids, hrefs, permissions, icons and content type definitions,
 * and nothing that renders a screen. See `src/lib/admin-nav.ts` and
 * `src/lib/content-registry.ts`; both explain why they are generated rather than
 * read from here.
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
  plugins: [
    buildPlugin({
      messages: packageMessages[BLOG.pluginId],
      pluginId: BLOG.pluginId,
    }),
    buildPlugin({
      messages: packageMessages[EXAMPLE.pluginId],
      pluginId: EXAMPLE.pluginId,
    }),
  ],
})
