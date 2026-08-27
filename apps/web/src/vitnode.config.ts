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
 * `blogPlugin()` / `examplePlugin()` entries. Those register AdminCP content
 * types, and to do that they import their admin screens - a Tiptap editor field,
 * a form layout, a table cell - which reach core's form stack and from there
 * `next/dynamic` and `next-intl/navigation`. This app has no Next.js and no
 * AdminCP, so registering them would mean importing an admin panel that cannot
 * render in order to get at a message file.
 *
 * **Stage 4 replaces the two `buildPlugin` calls with `blogPlugin()` and
 * `examplePlugin()`**, once plugin routing and the AdminCP move over and the form
 * stack no longer needs Next. Nothing else has to change: everything downstream
 * reads `pluginId` and `messages` off whatever is in this list, and it is the
 * same list either way.
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
