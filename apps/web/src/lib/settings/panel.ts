import type { QueryClient } from '@tanstack/react-query'
import type { SettingsNavKey } from '@vitnode/core/views/auth/settings/settings-nav'

import { formatPageTitle } from '@vitnode/core/lib/metadata'
import { createTranslator } from 'use-intl'

import type { Locale } from '#/lib/i18n/shared'

import { intlQueryOptions } from '#/lib/i18n/query'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * What every settings route needs, in one place: the strings, the tab title.
 *
 * Its own module rather than the layout route's, because three routes and a
 * breadcrumb all read the namespace list and a route file importing another route
 * file for it would be a cycle. What is here is the part that is identical for
 * every panel; what a panel actually renders is the panel's own route.
 */

/**
 * What the settings screens render strings from.
 *
 * `core.auth.settings` is the heading, the description, the navigation and every
 * panel's own title - the same namespace the Next.js layout mounts, kept
 * deliberately: the panels are shared components and they look their strings up
 * by the same keys in both frameworks.
 *
 * `core.global` is listed even though the root already provides it, because
 * `RouteMessages` mounts its own provider over the root's rather than adding to
 * it - so a set that omitted it would take the global strings away from
 * everything below.
 *
 * One list, read by the loader that fetches it, by the provider that mounts it
 * and by the breadcrumb, because they have to be the same set or a reader
 * suspends on a key nobody warmed.
 */
export const SETTINGS_NAMESPACES = [
  'core.auth.settings',
  'core.global',
] as const

/**
 * The branch of the message tree these routes read, named for
 * `createTranslator`.
 *
 * The cast this type serves is the same one `files.tsx` explains: the
 * translator's key type is derived from the *inferred* type of `messages`, and
 * `AbstractIntlMessages` is a bare index signature - so `MessageKeys` cannot tell
 * a leaf from a branch and collapses to `never`, making every key a type error.
 * Naming the keys these routes read is both the smallest fix and a true
 * statement: rename one in `core/locales/en.json` and this stops compiling rather
 * than rendering a raw message key into a `<title>`.
 */
interface SettingsMessages {
  core: {
    auth: {
      settings: {
        desc: string
        nav: { devices: string; overview: string; security: string }
        title: string
      }
    }
  }
}

/** The narrowest slice of a settings route's context the loaders below read. */
export interface SettingsLoaderContext {
  locale: Locale
  queryClient: QueryClient
}

/**
 * The settings messages, in the cache, before anything renders in them.
 *
 * Called by the layout and by each panel. The second call is a cache read rather
 * than a second request - same locale, same namespaces, therefore the same key -
 * and each panel calls it anyway so that a panel's loader is complete on its own
 * terms rather than relying on the order its parent's happened to run in.
 */
const ensureSettingsMessages = async (context: SettingsLoaderContext) =>
  await context.queryClient.ensureQueryData(
    intlQueryOptions({
      locale: context.locale,
      namespaces: SETTINGS_NAMESPACES,
    }),
  )

/**
 * One panel's tab title, as `"<Panel> - <Settings>"`.
 *
 * The same two lookups the Next.js pages do - `nav.<key>` and `title` - so both
 * frameworks produce the same string, and `formatPageTitle` then appends the
 * site name exactly as Next.js does through `title.template`. Translated in the
 * loader rather than in `head`, which receives no router context and so cannot
 * resolve a locale at all.
 */
export const settingsPanelTitle = ({
  locale,
  messages,
  navKey,
}: {
  locale: Locale
  messages: unknown
  navKey: SettingsNavKey
}): string => {
  const typed = messages as SettingsMessages
  const t = createTranslator({
    locale,
    messages: typed,
    namespace: 'core.auth.settings',
  })
  const tNav = createTranslator({
    locale,
    messages: typed,
    namespace: 'core.auth.settings.nav',
  })

  return `${tNav(navKey)} - ${t('title')}`
}

/**
 * A settings panel's loader: warm the strings, translate its title.
 *
 * Every panel's loader is this and nothing else, until a panel has data of its
 * own to fetch - at which point it awaits this alongside its own read rather
 * than replacing it.
 */
export const loadSettingsPanel = async (
  context: SettingsLoaderContext,
  navKey: SettingsNavKey,
): Promise<{ title: string }> => {
  const intl = await ensureSettingsMessages(context)

  return {
    title: settingsPanelTitle({
      locale: context.locale,
      messages: intl.messages,
      navKey,
    }),
  }
}

/**
 * A settings panel's `head`, which is a title and deliberately nothing else.
 *
 * `robots` is **not** here. The settings layout declares `noindex, nofollow`
 * once, and TanStack Start merges the `head` of every matched route - so the
 * whole subtree inherits it and a panel that restated it would be a second copy
 * to keep in step. See `routes/_main/_authenticated/settings.tsx`.
 *
 * `loaderData` is optional because the router types it so: it is `undefined`
 * while the route's loader is still pending, and a `head` that assumed otherwise
 * would throw during the first pass of a navigation.
 */
export const settingsPanelHead = (loaderData?: { title: string }) => ({
  meta: loaderData
    ? [
        {
          title: formatPageTitle(vitNodeShellConfig.metadata, loaderData.title),
        },
      ]
    : [],
})
