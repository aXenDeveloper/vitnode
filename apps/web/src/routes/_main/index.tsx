import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useRouterState } from '@tanstack/react-router'
import { ThemeSwitcher } from '@vitnode/core/components/switchers/themes/theme-switcher'
import { Button } from '@vitnode/core/components/ui/button'
import { TooltipWithContent } from '@vitnode/core/components/ui/tooltip'
import { formatPageTitle } from '@vitnode/core/lib/metadata'
import {
  intlQueryOptions,
  publicPathnameOf,
  useLocale,
} from '@vitnode/core/tanstack/i18n'
import { LanguageSwitcher } from '@vitnode/core/tanstack/layout'
import { toast } from 'sonner'
import { useTranslations } from 'use-intl'

import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * The locale-runtime verification page, and nothing more.
 *
 * What it renders is the shell and the locale runtime under it: the same page
 * at `/` and at `/pl`, one route file, the language taken from the URL,
 * `<html lang>` following it, the two languages' messages sitting side by side
 * in one cache, and a switcher that moves between them without a reload.
 *
 * It reads only `core.global`, from the root's provider, and mounts no
 * `RouteMessages` of its own - which is the one thing that makes it *not* a
 * proof that i18n works. A route's own namespaces are a separate contract, and
 * `/discover` and `/search` are the pages that exercise it. This page passing
 * while those failed is exactly the shape the Stage 9 i18n regression took.
 *
 * It is a scaffold, and the real homepage replaces it when one is designed.
 */
export const Route = createFileRoute('/_main/')({
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {vitNodeShellConfig.metadata.title} on TanStack Start
        </h1>

        <p className="text-muted-foreground leading-relaxed text-pretty">
          The VitNode application shell, rendering outside Next.js. This page is
          the locale runtime on its own - the feature routes prove the rest.
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

        {/*
          Per-key fallback, kept visible. `core.global.file.stored` is
          AutoForm's multi-file field copy - a form this app has no page for -
          so VitNode's Polish does not carry it and this row stays English while
          everything above it turns. That is the rule VitNode relies on: a
          partly translated language degrades one string at a time rather than
          rendering raw keys.

          It needs a key that is not going to be translated out from under it,
          which is why it is not one of the shell strings the migrated routes
          render. `toggle_sidebar` was the previous choice and Stage 10
          translated it.
        */}
        <Row label="Fallback - core.global.file.stored, untranslated in Polish">
          <span className="text-sm" data-testid="fallback">
            {t('file.stored')}
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
    </div>
  )
}
