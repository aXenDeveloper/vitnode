import type { QueryClient } from '@tanstack/react-query'

import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ThemeScript } from '@vitnode/core/components/theme-script'
import {
  intlQueryOptions,
  publicPathnameOf,
  resolveLocale,
  useLocale,
} from '@vitnode/core/tanstack/i18n'
import {
  ErrorActions,
  NotFound,
  VitNodeRootProviders,
} from '@vitnode/core/tanstack/layout'

import type { Locale } from '#/lib/i18n/shared'

import { vitNodeConfig } from '#/vitnode.config'

import appCss from '../styles.css?url'

const { debug, i18n, metadata, theme } = vitNodeConfig

export interface RootRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RootRouterContext>()({
  beforeLoad: ({ location }) => ({
    locale: resolveLocale<Locale>(publicPathnameOf(location)),
  }),
  component: RootComponent,
  head: () => ({
    links: [
      { href: appCss, rel: 'stylesheet' },

      {
        href: '/favicon.ico',
        rel: 'icon',
        sizes: '32x32',
        type: 'image/x-icon',
      },
    ],
    meta: [
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { title: metadata.title },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      intlQueryOptions({ locale: context.locale }),
    )
  },
  notFoundComponent: RootNotFound,
  shellComponent: RootDocument,
})

function RootNotFound() {
  return <NotFound actions={<ErrorActions />} />
}

function RootComponent() {
  return (
    <VitNodeRootProviders config={{ debug, locales: i18n.locales, theme }}>
      <Outlet />
    </VitNodeRootProviders>
  )
}

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
              position: 'bottom-left',
              triggerMode: 'fixed',
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
