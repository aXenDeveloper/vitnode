import { useLanguages } from '@vitnode/core/components/languages-provider'
import { LanguageSwitcherContent } from '@vitnode/core/components/switchers/langs/language-switcher-content'

import { useLocale, useSwitchLocale } from '#/lib/i18n/client'
import { isLocale } from '#/lib/i18n/shared'

/**
 * VitNode's language switcher, for TanStack Router.
 *
 * The same control as the Next.js app's - literally the same component now
 * (`LanguageSwitcherContent`), so the dropdown, the icon, the check mark and the
 * `core.global.language_switcher` label cannot drift between the two. What is
 * forked is the two lines that navigate: core's Next half replaces the pathname
 * through `next-intl`'s locale-aware router, and this one goes through Stage 3's
 * `useSwitchLocale`, which pushes the public href and invalidates.
 *
 * What it preserves is the whole point: the route, its params, its search string
 * and its hash. Only the locale prefix changes - and on a route that carries no
 * prefix (`/admin`) the cookie is the whole of the switch. All of that rule lives
 * in `#/lib/i18n/client`, not here.
 */
export const LanguageSwitcher = () => {
  const languages = useLanguages()
  const locale = useLocale()
  const switchLocale = useSwitchLocale()

  return (
    <LanguageSwitcherContent
      currentLocale={locale}
      onSelect={(code) => {
        // The list comes from configuration, so this always holds - and narrowing
        // it here is what keeps a locale cast out of a click handler.
        if (isLocale(code)) switchLocale(code)
      }}
      options={languages}
    />
  )
}
