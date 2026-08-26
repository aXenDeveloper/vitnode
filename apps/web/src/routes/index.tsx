import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useLanguages } from '@vitnode/core/components/languages-provider'
import { ThemeSwitcher } from '@vitnode/core/components/switchers/themes/theme-switcher'
import { Button } from '@vitnode/core/components/ui/button'
import { TooltipWithContent } from '@vitnode/core/components/ui/tooltip'
import { formatPageTitle } from '@vitnode/core/lib/metadata'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { shellIntlQueryOptions } from '#/lib/i18n'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * Stage 2's verification page, and nothing more.
 *
 * No VitNode feature route is migrated yet - `/discover`, search, auth and the
 * AdminCP all still live in the Next.js app. What this renders is the shell
 * itself: if the switcher flips the palette without a flash on reload, the toast
 * arrives styled, the tooltip opens, the language list is the configured one and
 * the query below is already resolved on the first paint, then config, metadata,
 * providers, theme, QueryClient and hydration are all wired up.
 *
 * It is a scaffold. Stage 3 replaces it with the real homepage.
 */
export const Route = createFileRoute('/')({
  component: Home,
  // Per-route metadata, through the same title rule Next.js applies through
  // `title.template`: "Stage 2 - VitNode".
  head: () => ({
    meta: [{ title: formatPageTitle(vitNodeShellConfig.metadata, 'Stage 2') }],
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
  const languages = useLanguages()
  const t = useTranslations('core.global')

  /**
   * The root route's loader already put this in the cache, and the SSR
   * integration carried it into the page - so `isFetching` is false on the very
   * first render, on the server and after hydration. A second QueryClient
   * anywhere in the tree would show up right here as a refetch.
   */
  const { data: intl, isFetching } = useQuery(shellIntlQueryOptions())

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {vitNodeShellConfig.metadata.title} on TanStack Start
        </h1>

        <p className="text-muted-foreground leading-relaxed text-pretty">
          The VitNode application shell, rendering outside Next.js. Stage 2 is
          infrastructure only - no feature route has moved yet.
        </p>
      </header>

      <section className="bg-card text-card-foreground flex flex-col gap-4 rounded-lg border p-6">
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

        <Row label="Languages - from this app's i18n config">
          <span className="text-sm">
            {languages.map((language) => language.name).join(', ')}
          </span>
        </Row>

        <Row label={`Messages - core.global.close in "${intl?.locale ?? '?'}"`}>
          <span className="text-sm">{t('close')}</span>
        </Row>

        <Row label="QueryClient - warmed by the root route's loader">
          <span className="text-sm">
            {isFetching ? 'fetching' : 'served from the cache'}
          </span>
        </Row>
      </section>
    </main>
  )
}
