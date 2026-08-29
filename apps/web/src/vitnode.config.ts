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
 * `blogPlugin()` / `examplePlugin()` entries. Those register AdminCP *content
 * types*, and to do that they import their content-editing screens - a Tiptap
 * editor field, a form layout, a table cell - which reach core's form stack and
 * from there `next/dynamic`. Registering them here would mean importing screens
 * this application cannot render in order to get at a message file.
 *
 * Stage 12 brought the AdminCP over but not the Content Engine: `/admin/content/*`
 * - the screens a content type contributes - is still served by the Next.js
 * application and is Stage 13's to move. **Stage 13 replaces the two
 * `buildPlugin` calls with `blogPlugin()` and `examplePlugin()`**, once those
 * screens no longer need Next. Nothing else has to change: everything downstream
 * reads `pluginId` and `messages` off whatever is in this list, and it is the
 * same list either way.
 *
 * The AdminCP sidebar does *not* wait for that. It is built from
 * `src/admin-nav.gen.ts` - one literal import per configured plugin that exports
 * a browser-safe `admin/nav` module - so the plugin groups, their content type
 * entries and their hand-declared entries are all on screen now, with the
 * content ones pointing at the legacy application until Stage 13 moves them. See
 * `src/lib/admin-nav.ts`.
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
