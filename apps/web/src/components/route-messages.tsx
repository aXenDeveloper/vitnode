import { useSuspenseQuery } from '@tanstack/react-query'
import { IntlProvider as CoreIntlProvider } from '@vitnode/core/lib/i18n/provider'
import { IntlProvider } from 'use-intl'

import { i18n } from '#/i18n'
import { useLocale } from '#/lib/i18n/client'
import { intlQueryOptions } from '#/lib/i18n/query'

/**
 * The strings one route renders, scoped to that route.
 *
 * The root provides `core.global` and nothing else, deliberately: the merged
 * message tree holds every plugin's AdminCP copy, and a page should ship only
 * the branches it actually renders. This is the other half of that rule - the
 * TanStack Start counterpart of `<I18nProvider namespaces={[...]}>`, which is
 * how the Next.js pages have always done it.
 *
 * ## It reads, it does not fetch
 *
 * `useSuspenseQuery` over the same `intlQueryOptions` the route's loader
 * already warmed, so on the first render the entry is there and nothing
 * suspends. A route that mounts this **must** ensure the identical options in
 * its loader - same locale, same namespaces - or the first paint is a suspend
 * and the strings arrive a round trip late.
 *
 * ## Why two providers
 *
 * One component, two module records. `@vitnode/core` is external to Vite's SSR
 * pass and therefore loaded by Node, while this app's source runs through
 * Vite's module runner - so `use-intl` imported here and `use-intl` imported
 * inside a core component can be two records with two React contexts. The
 * outer one covers this app's own code; the inner comes from core itself
 * (`@vitnode/core/lib/i18n/provider`) and so is by construction the record
 * every shared component reads. See the long note in `routes/__root.tsx`, which
 * has the same shape for the same reason.
 *
 * Both get the same props from one object: two providers that disagreed would
 * render half a page in the wrong language.
 */
export const RouteMessages = ({
  children,
  namespaces,
}: {
  children: React.ReactNode
  namespaces: readonly string[]
}) => {
  const locale = useLocale()
  const { data } = useSuspenseQuery(intlQueryOptions({ locale, namespaces }))

  const intlProps = {
    locale,
    messages: data.messages,
    timeZone: i18n.timeZone,
  }

  return (
    <IntlProvider {...intlProps}>
      <CoreIntlProvider {...intlProps}>{children}</CoreIntlProvider>
    </IntlProvider>
  )
}
