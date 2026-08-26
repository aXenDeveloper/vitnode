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
import { IntlProvider } from 'next-intl'

import { shellIntlQueryOptions } from '#/lib/i18n'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

import appCss from '../styles.css?url'

const { debug, i18n, metadata, theme } = vitNodeShellConfig

/**
 * What every route in this app can count on having: the QueryClient the router
 * owns. A loader reads it as `context.queryClient`.
 */
export interface RootRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RootRouterContext>()({
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
   * Warm the shell's translations before anything renders.
   *
   * The one line that proves the Stage 2 pipeline: the loader reaches the
   * QueryClient through the router context, and the component below reads the
   * result out of the cache rather than fetching it again.
   */
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(shellIntlQueryOptions())
  },
  shellComponent: RootDocument,
})

/**
 * The VitNode provider tree.
 *
 * Every provider here is shared with the Next.js app - `VitNodeProviders` is the
 * same module `apps/docs` mounts - except the intl provider, which is this
 * app's stand-in until Stage 3 brings the real locale runtime. `IntlProvider` is
 * `use-intl`'s own provider, re-exported by `next-intl`; nothing in that entry
 * imports `next/*`. The locale it is handed is the app's default one today, and
 * the request's in Stage 3 - by then this reads it off the route rather than off
 * the config.
 *
 * The QueryClient is deliberately absent: the router owns it and the SSR
 * integration mounts its provider above this tree.
 */
function RootComponent() {
  const { data: intl } = useSuspenseQuery(shellIntlQueryOptions())

  return (
    <IntlProvider
      locale={intl.locale}
      messages={intl.messages}
      timeZone={i18n.timeZone}
    >
      <VitNodeProviders config={{ debug, locales: i18n.locales, theme }}>
        <VitNodeWebSocketProvider>
          <Outlet />
        </VitNodeWebSocketProvider>
      </VitNodeProviders>
    </IntlProvider>
  )
}

/**
 * The document itself.
 *
 * `lang` comes from the app's configured default locale, not from the request:
 * resolving a visitor's locale is Stage 3's job, and this is the smallest thing
 * that is correct for a single-language install and honest about it for any
 * other. When Stage 3 lands, this reads the matched route's locale instead.
 *
 * `ThemeScript` has to be in the head, and it has to be inline: it applies the
 * stored theme to `<html>` before the browser paints, so the first frame is the
 * theme the visitor chose rather than a flash of the default one.
 * `suppressHydrationWarning` covers the attributes it writes, which by design
 * differ from what the server rendered.
 */
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={i18n.defaultLocale} suppressHydrationWarning>
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
