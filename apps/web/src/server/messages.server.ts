import '@tanstack/react-start/server-only'
import type { MessagesSource } from '@vitnode/core/lib/i18n/types'
import type { AbstractIntlMessages } from 'use-intl'

import { CONFIG_PLUGIN as CORE } from '@vitnode/core/config'
import { loadMessages } from '@vitnode/core/lib/i18n/load-messages'
import { pickMessages } from '@vitnode/core/lib/i18n/pick-messages'
import { buildAppMessagesSources } from '@vitnode/core/lib/i18n/sources'

import { packageMessages } from '#/locales/packages'
import { vitNodeConfig } from '#/vitnode.config'

/**
 * Everything that contributes translations, in the order they merge.
 *
 * Core first, then each registered plugin, then whatever this app overrides -
 * later sources win, so a plugin can reword a core string and the app can reword
 * either. That is exactly `buildMessagesSources`' order, written out rather than
 * called, because the loaders for the first two groups have to come from
 * `src/locales/packages.ts` instead of from each package's own barrel. See that
 * file for the reproduction.
 *
 * `scope` is part of `loadMessages`' cache key, and this app serves its API in
 * the same process - so the web tree has to be marked as one, or whichever of
 * the two loaded first would be served to both.
 */
const sources: MessagesSource[] = [
  { id: CORE.pluginId, messages: packageMessages[CORE.pluginId], scope: 'web' },
  ...vitNodeConfig.plugins.map(({ messages, pluginId }) => ({
    id: pluginId,
    messages,
    scope: 'web',
  })),
  ...buildAppMessagesSources(vitNodeConfig.i18n.messages, 'web'),
]

export interface IntlMessages {
  locale: string
  /**
   * The picked message tree, as `use-intl`'s own shape rather than a bare
   * `object`.
   *
   * It matters at both ends. `createTranslator` constrains its messages to an
   * indexable type, so an `object` there collapses every key it could translate
   * to `never` - which is how a route resolves its own metadata strings. And a
   * server function's return type has to prove itself serializable, which
   * `Record<string, unknown>` cannot: `unknown` might be a function. A tree of
   * strings can.
   */
  messages: AbstractIntlMessages
}

/**
 * The messages one page needs, in one language.
 *
 * Two arguments and no hidden state, deliberately. `locale` is passed in rather
 * than read from the request, so the same function serves SSR, a client-side
 * navigation, and a prefetch of a language the visitor is not currently reading
 * in - and so the query that calls it can be keyed by exactly what it asked for.
 *
 * `namespaces` is the other half of the rule VitNode has always had: the merged
 * tree holds every plugin's AdminCP copy, and a page that renders none of it
 * should not ship it. Only the branches named here cross to the browser. A page
 * asks for what it renders - `["core.global", "core.discover"]` - and gets that
 * and nothing else.
 *
 * Underneath, nothing about the pipeline is new: `loadMessages` merges core, the
 * plugins and the app's overrides for `locale`, with the default locale
 * underneath as a per-key fallback, so a half-translated language degrades one
 * string at a time instead of showing raw keys.
 *
 * Server-side because the message files live inside each package's build output.
 * The `server-only` import above turns "somebody imported this from a component"
 * into a build error rather than a mystery in the browser bundle.
 */
export const loadIntlMessages = async ({
  locale,
  namespaces,
}: {
  locale: string
  namespaces: readonly string[]
}): Promise<IntlMessages> => {
  const { defaultLocale } = vitNodeConfig.i18n

  const merged = await loadMessages({ defaultLocale, locale, sources })

  // `pickMessages` walks an unknown tree and cannot know what it found; what it
  // returns is a message tree by construction, every leaf a string from a JSON
  // file. Asserted here, once, rather than by every caller.
  return {
    locale,
    messages: pickMessages(merged, namespaces) as AbstractIntlMessages,
  }
}
