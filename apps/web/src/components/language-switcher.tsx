import { useLanguages } from '@vitnode/core/components/languages-provider'
import { Button } from '@vitnode/core/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@vitnode/core/components/ui/dropdown-menu'
import { CheckIcon, LanguagesIcon } from 'lucide-react'
import { useTranslations } from 'use-intl'

import type { Locale } from '#/lib/i18n/shared'

import { useLocale, useSwitchLocale } from '#/lib/i18n/client'

/**
 * VitNode's language switcher, for TanStack Router.
 *
 * The same control as `@vitnode/core`'s - the same dropdown, the same icons, the
 * same `core.global.language_switcher` label - over a different navigation
 * layer. Core's version is built on `next-intl/navigation`'s `useRouter`, which
 * is Next.js all the way down; this one is built on the router that is actually
 * mounted here. Sharing the markup and forking the two lines that navigate is
 * cheaper than a navigation abstraction that has to satisfy both.
 *
 * What it preserves is the whole point: the route, its params, its search
 * string and its hash. Only the locale prefix changes.
 */
export const LanguageSwitcher = () => {
  const languages = useLanguages()
  const locale = useLocale()
  const switchLocale = useSwitchLocale()
  const t = useTranslations('core.global')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t('language_switcher')}
            size="icon"
            variant="ghost"
          />
        }
      >
        <LanguagesIcon />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => {
              switchLocale(language.code as Locale)
            }}
          >
            {language.name}

            {language.code === locale && (
              <CheckIcon aria-hidden className="ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
