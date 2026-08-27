import type { QueryClient } from '@tanstack/react-query'

import { TanStackDevtools } from '@tanstack/react-devtools'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ThemeScript } from '@vitnode/core/components/theme-script'
import { VitNodeProviders } from '@vitnode/core/views/layouts/providers'
import { VitNodeWebSocketProvider } from '@vitnode/core/ws/provider'
import { IntlProvider as NextIntlProvider } from 'next-intl'
import { IntlProvider } from 'use-intl'

import { publicPathnameOf, resolveLocale, useLocale } from '#/lib/i18n/client'
import { intlQueryOptions } from '#/lib/i18n/query'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

import appCss from '../styles.css?url'

const { debug, i18n, metadata, theme } = vitNodeShellConfig

/**
 * What the router itself provides, before any route has run.
 *
 * Just the QueryClient. `beforeLoad` below adds `locale` on top, so what a
 * loader actually receives is `{ queryClient, locale }` - the language included,
 * because a loader that fetches anything user-facing needs to know which one it
 * is fetching.
 */
export interface RootRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RootRouterContext>()({
  /**
   * The request's language, resolved once and handed to every loader below.
   *
   * The same function the rewrite and the components use, so there is one answer
   * per request rather than one per consumer. Note that a language switch does
   * not change the *internal* URL - only the public one - so the switcher
   * invalidates the router to bring this back in step.
   */
  beforeLoad: ({ location }) => ({
    locale: resolveLocale(publicPathnameOf(location)),
  }),
  component: RootComponent,
  head: () => ({
    links: [{ href: appCss, rel: 'stylesheet' }],
    meta: [
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      // The default title, from the app's config. A route that names itself
      // renders `"<page> - <shortTitle>"` instead, through `formatPageTitle` -
      // the same rule Next.js applies through `title.template`.
      { title: metadata.title },
    ],
  }),
  /**
   * Warm this language's shell strings before anything renders.
   *
   * `context.locale` rather than a default: `/pl` has to arrive with Polish
   * already in the cache, or the first paint is English and the page flips after
   * hydration.
   */
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      intlQueryOptions({ locale: context.locale }),
    )
  },
  shellComponent: RootDocument,
})

/**
 * The VitNode provider tree.
 *
 * Every provider here is shared with the Next.js app - `VitNodeProviders` is the
 * same module `apps/docs` mounts - except the intl provider, which is where the
 * two frameworks meet their own halves of `use-intl`. This app resolves the
 * locale from the URL and hands it straight to `use-intl`; Next.js gets it from
 * its request scope through `next-intl`. Same library, same messages.
 *
 * ## Why the provider is mounted twice
 *
 * `IntlProvider` is one component - `next-intl` re-exports `use-intl`'s, and
 * `NextIntlClientProvider` is that same component with a `locale` guard in front
 * of it. What differs is the *module record* it was loaded from. This app's
 * source goes through Vite's SSR module runner; `@vitnode/core` is external
 * (`vite.config.ts`) and so is loaded by Node, and the `use-intl` it reaches
 * through `next-intl` is a second instance with its own React context. Proven by
 * identity, in a dev render:
 *
 *     IntlProvider (use-intl) === IntlProvider (use-intl/react)  -> true
 *     IntlProvider (use-intl) === IntlProvider (next-intl)       -> false
 *
 * So core's 151 shared components - every `useTranslations` in the design
 * system - look for a context this app would otherwise never have provided, and
 * the first of them to render throws. A production build happens to bundle both
 * into one chunk and collapse the two into one, which is exactly what made this
 * a `vite dev`-only 500 that the built server never showed.
 *
 * Both records therefore get the same locale and the same messages. The cost is
 * one extra context; the alternative is the app's own code importing from
 * `next-intl`, which is the dependency this stage is meant to be shedding.
 *
 * **Stage 4 deletes the inner one**, once `@vitnode/core` imports `use-intl`
 * directly and there is only one record left to provide.
 * `src/tests/intl-provider.test.ts` fails if it is removed early.
 *
 * Because the locale comes from router state, changing language re-renders this:
 * new locale, new query key, new messages, no page reload.
 *
 * The QueryClient is deliberately absent: the router owns it and the SSR
 * integration mounts its provider above this tree.
 */
function RootComponent() {
  const locale = useLocale()
  const { data: intl } = useSuspenseQuery(intlQueryOptions({ locale }))
  const intlProps = {
    locale,
    messages: intl.messages,
    timeZone: i18n.timeZone,
  }

  return (
    <IntlProvider {...intlProps}>
      <NextIntlProvider {...intlProps}>
        <VitNodeProviders config={{ debug, locales: i18n.locales, theme }}>
          <VitNodeWebSocketProvider>
            <Outlet />
          </VitNodeWebSocketProvider>
        </VitNodeProviders>
      </NextIntlProvider>
    </IntlProvider>
  )
}

/**
 * The document itself.
 *
 * `lang` is the language this request actually resolved to - `en` for `/`, `pl`
 * for `/pl`, and on a route outside the localized URL space (`/admin`) whatever
 * the visitor's cookie says. It comes from the same router state the provider
 * reads, so the two cannot disagree and hydration has nothing to complain about.
 *
 * `ThemeScript` has to be in the head, and it has to be inline: it applies the
 * stored theme to `<html>` before the browser paints, so the first frame is the
 * theme the visitor chose rather than a flash of the default one.
 * `suppressHydrationWarning` covers the attributes it writes, which by design
 * differ from what the server rendered.
 */
function RootDocument({ children }: { children: React.ReactNode }) {
  const locale = useLocale()

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
        <ThemeScript {...theme} />
      </head>

      <body suppressHydrationWarning>
        {children}

        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'TanStack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              {
                name: 'TanStack Query',
                render: <ReactQueryDevtoolsPanel />,
              },
            ]}
          />
        ) : null}

        <Scripts />
      </body>
    </html>
  )
}
