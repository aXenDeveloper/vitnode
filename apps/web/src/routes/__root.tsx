import type { QueryClient } from '@tanstack/react-query'

import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { ThemeScript } from '@vitnode/core/components/theme-script'
import {
  intlQueryOptions,
  publicPathnameOf,
  resolveLocale,
  useLocale,
} from '@vitnode/core/tanstack/i18n'
import {
  DocumentHead,
  DocumentScripts,
  VitNodeRootProviders,
} from '@vitnode/core/tanstack/layout'
import { documentSocialMeta } from '@vitnode/core/tanstack/metadata'

import type { Locale } from '@/vitnode.config'

import { isDocsRouteId, STYLESHEET_ORDER_ANCHOR } from '@/docs/stylesheet'
import { withoutHmrTimestamp } from '@/lib/without-hmr-timestamp'
import { vitNodeConfig } from '@/vitnode.config'

import appCss from '../styles.css?url'

const { editor, i18n, logo, metadata, theme } = vitNodeConfig

export interface RootRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RootRouterContext>()({
  beforeLoad: ({ location }) => {
    const publicPathname = publicPathnameOf(location)

    return {
      locale: resolveLocale<Locale>(publicPathname),
      publicPathname,
    }
  },
  component: RootComponent,
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...intlQueryOptions({ locale: context.locale }),
      staleTime: 'static',
    })
  },
  head: ({ match, matches }) => ({
    links: [
      ...(matches.some(({ routeId }) => isDocsRouteId(routeId))
        ? []
        : [{ href: withoutHmrTimestamp(appCss), rel: 'stylesheet' }]),

      {
        href: '/favicon.ico',
        rel: 'icon',
        sizes: '32x32',
        type: 'image/x-icon',
      },
      { href: '/logo_vitnode_icon.svg', rel: 'icon', type: 'image/svg+xml' },
      {
        href: '/apple-touch-icon.png',
        rel: 'apple-touch-icon',
        sizes: '180x180',
      },
      { href: '/site.webmanifest', rel: 'manifest' },
    ],
    meta: [
      { charSet: 'utf-8' },
      {
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
        name: 'viewport',
      },
      { title: metadata.title },
      ...documentSocialMeta({
        locale: match.context.locale,
        pathname: match.context.publicPathname,
      }),
    ],
  }),
  shellComponent: RootDocument,
})

function RootComponent() {
  return (
    <VitNodeRootProviders
      config={{ editor, locales: i18n.locales, logo, theme }}
    >
      <Outlet />
    </VitNodeRootProviders>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const locale = useLocale()

  return (
    <html dir="ltr" lang={locale} suppressHydrationWarning>
      <head>
        <style href={STYLESHEET_ORDER_ANCHOR} precedence="default" />
        <DocumentHead />
        <meta
          content="#f9fafb"
          media="(prefers-color-scheme: light)"
          name="theme-color"
        />
        <meta
          content="#0c0e12"
          media="(prefers-color-scheme: dark)"
          name="theme-color"
        />
        <ThemeScript {...theme} />
      </head>

      <body suppressHydrationWarning>
        {children}
        <DocumentScripts />
      </body>
    </html>
  )
}
