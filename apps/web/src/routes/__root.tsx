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
import { VitNodeRootProviders } from '@vitnode/core/tanstack/layout'

import type { Locale } from '#/lib/i18n/shared'

import { vitNodeShellConfig } from '#/vitnode.shell.config'

import appCss from '../styles.css?url'

const { debug, i18n, metadata, theme } = vitNodeShellConfig

/**
 * What the router itself provides, before any route has run.
 *
 * The QueryClient, and the route tree's answer to "do I serve this path?".
 * `beforeLoad` below adds `locale` on top, so what a loader actually receives is
 * `{ ownsPath, queryClient, locale }` - the language included, because a loader
 * that fetches anything user-facing needs to know which one it is fetching.
 *
 * `ownsPath` is here rather than derived per route because `beforeLoad` receives
 * no router, and the login guard has to make the same migration decision
 * `MigrationLink` makes for a rendered link. See `src/router.tsx`, which wires
 * it, and `#/migration/navigation`, which owns the rule.
 */
export interface RootRouterContext {
  ownsPath: (href: string) => boolean
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
    locale: resolveLocale<Locale>(publicPathnameOf(location)),
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
 * The VitNode provider tree, mounted once above every route.
 *
 * Every provider in it is shared with the Next.js app - the theme, the toaster,
 * the tooltip provider, the WebSocket - plus the pair of `use-intl` records that
 * only a package can name. `VitNodeRootProviders` owns all of it, including the
 * argument for why the realtime listeners are inside it rather than in the main
 * shell.
 *
 * What this route contributes is the two things an application owns: which
 * languages it serves, and its theme defaults.
 *
 * Because the locale comes from router state, changing language re-renders this:
 * new locale, new query key, new messages, no page reload.
 */
function RootComponent() {
  return (
    <VitNodeRootProviders config={{ debug, locales: i18n.locales, theme }}>
      <Outlet />
    </VitNodeRootProviders>
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
