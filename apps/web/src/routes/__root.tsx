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
import { IntlProvider as CoreIntlProvider } from '@vitnode/core/lib/i18n/provider'
import { VitNodeProviders } from '@vitnode/core/views/layouts/providers'
import { VitNodeWebSocketProvider } from '@vitnode/core/ws/provider'
import { IntlProvider } from 'use-intl'

import { RealtimeListeners } from '#/components/realtime-listeners'
import { publicPathnameOf, resolveLocale, useLocale } from '#/lib/i18n/client'
import { intlQueryOptions } from '#/lib/i18n/query'
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
 * it, and `#/lib/migration-navigation`, which owns the rule.
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
 * `IntlProvider` is one component, imported from two places, and under
 * `vite dev` those are two *module records* with two React contexts. This app's
 * source goes through Vite's SSR module runner, which resolves `use-intl` with
 * the `development` export condition; `@vitnode/core` is external
 * (`vite.config.ts`) and so is loaded by Node, which resolves the same package
 * to its `default` (production) build. Same version, same `node_modules` entry,
 * two files - and `createContext` runs once per file. Proven by identity, in a
 * dev render:
 *
 *     IntlProvider (use-intl)      === IntlProvider (use-intl/react)  -> true
 *     IntlProvider (use-intl)      === IntlProvider (core's provider) -> false
 *     IntlProvider (core provider) === the record core's components read -> true
 *
 * So core's shared components - every `useTranslations` in the design system -
 * look for a context this app would otherwise never have provided, and the
 * first of them to render throws. A production build bundles both into one
 * chunk and collapses the two into one, which is exactly what made this a
 * `vite dev`-only 500 that the built server never showed.
 *
 * The inner one is core's own export rather than `next-intl`'s. Both resolve to
 * the same record today - `next-intl` re-exports `use-intl/react`'s provider
 * verbatim - but only one of them *says* so: `@vitnode/core/lib/i18n/provider`
 * is loaded by whatever loaded the package, which is by construction the record
 * core's components read. Reaching through `next-intl` for it was a coincidence
 * that happened to hold, and it is the dependency this migration is shedding -
 * no module this app renders imports `next-intl` any more.
 *
 * Both records get the same locale and the same messages, from one object.
 * `RouteMessages` mounts the same pair for a route's own namespaces, for the
 * same reason. `src/tests/intl-provider.test.ts` fails if either is removed
 * while two records still exist.
 *
 * Because the locale comes from router state, changing language re-renders this:
 * new locale, new query key, new messages, no page reload.
 *
 * The QueryClient is deliberately absent: the router owns it and the SSR
 * integration mounts its provider above this tree.
 *
 * ## Why `RealtimeListeners` is here rather than in the shell
 *
 * It is the one non-provider in this tree, and it is here for the same reason
 * every provider is: its lifetime is the WebSocket connection's, not any route's.
 * The main shell is not mounted on `/login`, so a sync that lived there would
 * miss the sign-in that happens on it - see the long note in
 * `#/components/realtime-listeners`, which owns that argument. Inside the
 * provider, because that is the context it reads.
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
      <CoreIntlProvider {...intlProps}>
        <VitNodeProviders config={{ debug, locales: i18n.locales, theme }}>
          <VitNodeWebSocketProvider>
            <RealtimeListeners />
            <Outlet />
          </VitNodeWebSocketProvider>
        </VitNodeProviders>
      </CoreIntlProvider>
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
