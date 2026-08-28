import { useSuspenseQuery } from '@tanstack/react-query'
import { useLanguages } from '@vitnode/core/components/languages-provider'
import { LogoVitNode } from '@vitnode/core/components/logo-vitnode'
import { HeaderLayoutContent } from '@vitnode/core/views/layouts/theme/header/header-content'
import {
  HEADER_NAV_MESSAGE_KEYS,
  headerNavItems,
} from '@vitnode/core/views/layouts/theme/header/header-nav'
import { createTranslator } from 'use-intl'

import type { Locale } from '#/lib/i18n/shared'

import { LanguageSwitcher } from '#/components/language-switcher'
import { MigrationLink } from '#/components/migration-link'
import { useLocale } from '#/lib/i18n/client'
import { intlQueryOptions } from '#/lib/i18n/query'

/** What the header renders strings from: the shell's set, plus the nav labels. */
export const HEADER_NAMESPACES = ['core.global', 'core.search'] as const

/**
 * The messages the header renders, as a query the shell's loader can ensure.
 *
 * Exported so the loader and the component cannot ask for different sets: the
 * namespace list is part of the query key, so a shell that warmed
 * `["core.global"]` would leave the header suspending on a key nobody fetched.
 */
export const headerIntlQueryOptions = ({ locale }: { locale: Locale }) =>
  intlQueryOptions({ locale, namespaces: HEADER_NAMESPACES })

/**
 * The main header, on TanStack Start.
 *
 * The bar, the logo, the nav and the action area are `HeaderLayoutContent` - the
 * same module the Next.js pages render, so there is one copy of that markup
 * rather than one per framework. What this supplies is the three things a shared
 * component cannot resolve for itself: the link, the language switcher, and the
 * translated nav.
 *
 * ## The link is `MigrationLink`
 *
 * Not the router's `Link` directly. `/`, `/discover` and `/search` are all
 * routes this app owns today, so all three are client-side navigations with the
 * locale prefix written by Stage 3's rewrite - no prefix is applied here, and
 * applying one would produce `/pl/pl/discover`. `MigrationLink` asks the route
 * tree that question per href, which is what makes a header link that later
 * points at a route the Next.js app still serves (`/files`, `/admin`) a document
 * load into that app instead of a TanStack not-found. There is no allowlist of
 * migrated routes in that decision - the route tree is the list.
 *
 * ## The strings, and what the shell has to warm
 *
 * The labels are `core.search.nav.*` - the same keys the Next.js header reads,
 * paired with their hrefs by the same `headerNavItems`. The header sits above
 * every route, so it cannot rely on a route's own `RouteMessages`: it reads the
 * messages out of the cache itself and translates them with `use-intl`'s
 * framework-free `createTranslator`.
 *
 * That makes one demand on whoever mounts it: **the shell's loader must warm
 * {@link headerIntlQueryOptions}**, which `_main`'s does. It is a
 * `useSuspenseQuery` with no boundary between it and the document, so an
 * unwarmed entry does not degrade - it suspends the whole response. Warming it
 * is one line, and it is the same rule every migrated route already follows for
 * its own namespaces.
 *
 * No provider is mounted here. `core.global` - which the theme switcher and the
 * language switcher read - is provided by the root route, and the two extra
 * words the nav needs are not worth replacing the message tree over.
 */
export const Header = ({
  logo = <LogoVitNode className="w-34" />,
  user,
}: {
  /** The application's mark. Defaults to VitNode's, as both Next.js apps pass. */
  logo?: React.ReactNode
  /** The session slot - avatar and menu when signed in, sign-in button when not. */
  user?: React.ReactNode
}) => {
  const locale = useLocale()
  const languages = useLanguages()
  const { data } = useSuspenseQuery(headerIntlQueryOptions({ locale }))

  const t = createTranslator({
    locale,
    messages: data.messages,
    namespace: 'core.search',
  })

  return (
    <HeaderLayoutContent
      // One language means nothing to switch to - the same call the Next.js
      // header makes, from the provider that was given the list rather than
      // from the config.
      languageSwitcher={languages.length > 1 ? <LanguageSwitcher /> : null}
      LinkComponent={MigrationLink}
      logo={logo}
      navigation={headerNavItems({
        discover: t(HEADER_NAV_MESSAGE_KEYS.discover),
        search: t(HEADER_NAV_MESSAGE_KEYS.search),
      })}
      user={user}
    />
  )
}
