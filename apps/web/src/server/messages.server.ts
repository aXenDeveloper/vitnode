import '@tanstack/react-start/server-only'
import type { MessagesSource } from '@vitnode/core/lib/i18n/types'

import { CONFIG_PLUGIN as CORE } from '@vitnode/core/config'
import { loadMessages } from '@vitnode/core/lib/i18n/load-messages'
import { pickMessages } from '@vitnode/core/lib/i18n/pick-messages'

import { packageMessages } from '#/locales'
import { vitNodeConfig } from '#/vitnode.config'

export interface ShellIntl {
  locale: string
  messages: object
}

/**
 * Everything that contributes translations, in the order they merge.
 *
 * Core first, then each registered plugin - later sources win, so a plugin can
 * reword a core string. That is `buildMessagesSources`' order, written out rather
 * than called: that function reaches for core's own locale barrel, which is the
 * one thing this app cannot load (see `src/locales.ts`).
 *
 * `scope` is part of `loadMessages`' cache key, and this app serves its API in
 * the same process - so the web tree has to be marked as one, or whichever of the
 * two loaded first would be served to both.
 */
const sources: MessagesSource[] = [
  { id: CORE.pluginId, messages: packageMessages[CORE.pluginId], scope: 'web' },
  ...vitNodeConfig.plugins.map(({ messages, pluginId }) => ({
    id: pluginId,
    messages,
    scope: 'web',
  })),
]

/**
 * The translations the app shell needs, for the app's default locale.
 *
 * A stand-in, and a deliberately small one. VitNode's real locale resolution
 * reads the `[locale]` route segment, negotiates against the visitor's
 * `Accept-Language` and prefixes every URL accordingly - that is the i18n
 * migration, and it belongs to Stage 3. Until then the shell renders in
 * `i18n.defaultLocale`, which is what a single-language install gets anyway.
 *
 * **Stage 3 replaces the locale below with the request's.** Nothing else about
 * this pipeline should need to change: `loadMessages` already merges every source
 * for whichever locale it is handed, with the default locale underneath as a
 * per-key fallback, and the query that calls this is already keyed by locale.
 *
 * Only `core.global` crosses to the browser. The merged tree holds every plugin's
 * AdminCP copy, and a page that renders none of it should not ship it - the same
 * rule `I18nProvider` applies in the Next.js app, through the same function.
 *
 * Server-side because the message files live inside each package's build output.
 * The `server-only` import above turns "somebody imported this from a component"
 * into a build error rather than a mystery in the browser bundle.
 */
export const loadShellIntl = async (): Promise<ShellIntl> => {
  const { defaultLocale } = vitNodeConfig.i18n
  const locale = defaultLocale

  const merged = await loadMessages({ defaultLocale, locale, sources })

  return { locale, messages: pickMessages(merged, ['core.global']) }
}
