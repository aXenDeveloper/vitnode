import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useRouterState } from '@tanstack/react-router'
import { ThemeSwitcher } from '@vitnode/core/components/switchers/themes/theme-switcher'
import { Button } from '@vitnode/core/components/ui/button'
import { TooltipWithContent } from '@vitnode/core/components/ui/tooltip'
import { formatPageTitle } from '@vitnode/core/lib/metadata'
import { toast } from 'sonner'
import { useTranslations } from 'use-intl'

import { LanguageSwitcher } from '#/components/language-switcher'
import { publicPathnameOf, useLocale } from '#/lib/i18n/client'
import { intlQueryOptions } from '#/lib/i18n/query'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * The Stage 3 verification page, and nothing more.
 *
 * No VitNode feature route is migrated yet - `/discover`, search, auth and the
 * AdminCP all still live in the Next.js app. What this renders is the shell and
 * the locale runtime under it: the same page at `/` and at `/pl`, one route
 * file, the language taken from the URL, `<html lang>` following it, the two
 * languages' messages sitting side by side in one cache, and a switcher that
 * moves between them without a reload.
 *
 * It is a scaffold. Stage 4 replaces it with the real homepage.
 */
export const Route = createFileRoute('/')({
  component: Home,
  // Per-route metadata, through the same title rule Next.js applies through
  // `title.template`: "Stage 3 - VitNode".
  head: () => ({
    meta: [{ title: formatPageTitle(vitNodeShellConfig.metadata, 'Stage 3') }],
  }),
})

const Row = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => (
  <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
    <span className="text-muted-foreground text-sm leading-relaxed">
      {label}
    </span>

    {children}
  </div>
)

function Home() {
  const locale = useLocale()
  const t = useTranslations('core.global')

  /**
   * Both halves of the rewrite, side by side: what the route tree matched, and
   * what the address bar shows. `/pl` and `/` are the same `location.pathname`.
   */
  const location = useRouterState({ select: (state) => state.location })

  /**
   * The root route's loader already put this in the cache for this locale, and
   * the SSR integration carried it into the page - so `isFetching` is false on
   * the very first render, on the server and after hydration. A second
   * QueryClient anywhere in the tree would show up right here as a refetch.
   */
  const { isFetching } = useQuery(intlQueryOptions({ locale }))

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {vitNodeShellConfig.metadata.title} on TanStack Start
        </h1>

        <p className="text-muted-foreground leading-relaxed text-pretty">
          The VitNode application shell, rendering outside Next.js. Stage 3 is
          the locale runtime - no feature route has moved yet.
        </p>
      </header>

      <section className="bg-card text-card-foreground flex flex-col gap-4 rounded-lg border p-6">
        <Row label="Language - switches without reloading the document">
          <LanguageSwitcher />
        </Row>

        <Row label="Locale - resolved from the public URL">
          <span className="text-sm" data-testid="locale">
            {locale}
          </span>
        </Row>

        <Row label="URL - what the router matched, and what the browser shows">
          <span className="text-sm">
            {location.pathname} &rarr; {location.publicHref}
          </span>
        </Row>

        <Row label={`Messages - core.global.close in "${locale}"`}>
          <span className="text-sm" data-testid="close">
            {t('close')}
          </span>
        </Row>

        <Row label="Fallback - core.global.loading, untranslated in Polish">
          <span className="text-sm" data-testid="loading">
            {t('loading')}
          </span>
        </Row>

        <Row label="QueryClient - warmed by the root route's loader">
          <span className="text-sm">
            {isFetching ? 'fetching' : 'served from the cache'}
          </span>
        </Row>

        <Row label="Links - one route, prefixed by the current locale">
          <Link className="text-sm underline" to="/">
            {publicPathnameOf(location)}
          </Link>
        </Row>

        <Row label="Theme - provider, no-flash script and switcher">
          <ThemeSwitcher />
        </Row>

        <Row label="Toaster - core's sonner, themed by the provider">
          <Button
            onClick={() => {
              toast.success(vitNodeShellConfig.metadata.title, {
                description: 'The shared Toaster is mounted and themed.',
              })
            }}
            variant="outline"
          >
            Show a toast
          </Button>
        </Row>

        <Row label="Tooltip - core's TooltipProvider">
          <TooltipWithContent text="TooltipProvider is mounted.">
            <Button variant="outline">Hover me</Button>
          </TooltipWithContent>
        </Row>
      </section>
    </main>
  )
}
