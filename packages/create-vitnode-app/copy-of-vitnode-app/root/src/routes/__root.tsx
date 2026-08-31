import type { QueryClient } from "@tanstack/react-query";

import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ThemeScript } from "@vitnode/core/components/theme-script";
import {
  intlQueryOptions,
  publicPathnameOf,
  resolveLocale,
  useLocale,
} from "@vitnode/core/tanstack/i18n";
import {
  ErrorActions,
  NotFound,
  VitNodeRootProviders,
} from "@vitnode/core/tanstack/layout";

import type { Locale } from "#/lib/i18n/shared";

import { vitNodeShellConfig } from "#/vitnode.shell.config";

import appCss from "../styles.css?url";

const { debug, i18n, metadata, theme } = vitNodeShellConfig;

/**
 * What the router itself provides, before any route has run.
 *
 * The QueryClient, and nothing else. `beforeLoad` below adds `locale` on top, so
 * what a loader actually receives is `{ queryClient, locale }` - the language
 * included, because a loader that fetches anything user-facing needs to know
 * which one it is fetching.
 */
export interface RootRouterContext {
  queryClient: QueryClient;
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
    links: [
      { href: appCss, rel: "stylesheet" },
      /*
       * The tab icon, from `public/favicon.ico`.
       *
       * Stated rather than left to the browser's automatic `/favicon.ico`
       * request, because that request is a 404 until the file exists and a
       * silently missing icon is easy to never notice. Drop your own 32px `.ico`
       * at `public/favicon.ico`; it lives there rather than being imported so
       * that the URL is stable and the file is still reachable at the well-known
       * path browsers ask for unprompted.
       */
      {
        href: "/favicon.ico",
        rel: "icon",
        sizes: "32x32",
        type: "image/x-icon",
      },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      // The default title, from the app's config. A route that names itself
      // renders `"<page> - <shortTitle>"` instead, through `formatPageTitle`.
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
    );
  },
  /**
   * Every URL this application does not serve.
   *
   * The last resort, and until now there was none: a path that matched no route
   * at all fell through to TanStack Router's own `<p>Not Found</p>` - no shell,
   * no strings, no way back - and the router warned about the missing option on
   * every such navigation. `/admin/contents` and a hand-typed `/blog/post-30`
   * both landed there.
   *
   * ## What reaches it, and what does not
   *
   * Only a path **no route matched**. A route that matched and then answered
   * `notFound()` from its own loader is caught by the nearest
   * `notFoundComponent` above it, which is why `/admin/content/nope` and
   * `/admin/content/blog/articles/999999/edit` render the AdminCP's 404 inside
   * the panel rather than this - see `_admin`'s, which mounts the shell around
   * the same message.
   *
   * ## It is a 404, and not a redirect anywhere
   *
   * The route tree is the whole application, so a URL that reaches here is one
   * somebody typed or a stale bookmark, and saying so is the honest answer.
   * Bouncing an unmatched path at some other origin would hide a genuinely
   * missing page behind a hop to a server that 404s it anyway. Where a URL is
   * served from is a deployment question, and a proxy in front of the app
   * answers it better than this route can.
   */
  notFoundComponent: RootNotFound,
  shellComponent: RootDocument,
});

/**
 * Rendered inside `RootComponent`, which is what makes the strings work: the
 * providers it mounts include `RouteMessages` with `core.global`, and that is
 * the namespace `NotFound` reads its two lines from. The root's loader has
 * already warmed that entry, so nothing suspends.
 */
function RootNotFound() {
  return <NotFound actions={<ErrorActions />} />;
}

/**
 * The VitNode provider tree, mounted once above every route.
 *
 * The theme, the toaster, the tooltip provider and the WebSocket, plus the pair
 * of `use-intl` records that only a package can name. `VitNodeRootProviders` owns
 * all of it, including the argument for why the realtime listeners are inside it
 * rather than in the main shell.
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
  );
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
  const locale = useLocale();

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
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "TanStack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
              {
                name: "TanStack Query",
                render: <ReactQueryDevtoolsPanel />,
              },
            ]}
          />
        ) : null}

        <Scripts />
      </body>
    </html>
  );
}
