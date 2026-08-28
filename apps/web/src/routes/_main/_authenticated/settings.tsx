import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { SettingsNavContent } from '@vitnode/core/views/auth/settings/nav-content'
import { isSettingsRootPath } from '@vitnode/core/views/auth/settings/settings-nav'
import { SettingsShellContent } from '@vitnode/core/views/auth/settings/shell-content'

import { SettingsBreadcrumb } from '#/components/layout/settings-breadcrumb'
import { MigrationLink } from '#/components/migration-link'
import { RouteMessages } from '#/components/route-messages'
import { intlQueryOptions } from '#/lib/i18n/query'
import { SETTINGS_NAMESPACES } from '#/lib/settings/panel'

/**
 * The settings screens' own layout - the heading, the navigation card, and the
 * panel every settings page renders inside.
 *
 * A real nested layout route rather than a wrapper each page remembers to
 * render: `settings.tsx` alongside a `settings/` directory makes this the parent
 * of `/settings`, `/settings/overview` and `/settings/security`, so a panel joins
 * the frame by *where its file lives*. That is the same rule `_main` uses for the
 * application shell and `_authenticated` for the session guard, and it is what
 * keeps the frame from being copied into three (soon four) route files that would
 * then drift.
 *
 * One route file serving two public URL shapes: `/settings/security` and
 * `/pl/settings/security` both match here, because the locale is stripped before
 * matching and written back into every link the router builds (`rewrite` in
 * `src/router.tsx`). Nothing in this subtree mentions a language.
 *
 * ## Where it sits, and what that buys
 *
 * Under `_main` for the shell and under `_authenticated` for the guard. There is
 * deliberately **no session check in this subtree**: the Next.js layout opens with
 * `getSessionApi()` and `notFound()` because it has nowhere else to put the rule,
 * and here that rule is `routes/_main/_authenticated.tsx`, running in
 * `beforeLoad` before any of this renders. An anonymous visitor to
 * `/settings/security` is answered with `/login?returnTo=/settings/security` -
 * no locale in the round-trip value, because the rewrite writes that back on the
 * way home - and receives no byte of a settings page.
 *
 * A second check here would not be defence in depth, it would be a second rule to
 * keep in step with the first. The actual boundary is neither: every settings
 * read and write is authorized by Hono from the session cookie in the API's own
 * handlers, which is what a future panel's data will rely on.
 *
 * ## What it owns, so that no panel does
 *
 * The `container`, the `<h1>` and its description, the navigation card, the panel
 * card, the mobile back link and the narrow-screen rule that shows the menu on
 * `/settings` and the panel everywhere else. A panel route renders only its own
 * contents - a heading and, in time, a form.
 *
 * `SettingsShellContent` and `SettingsNavContent` are the same modules the
 * Next.js layout renders. The two things a shared component cannot resolve for
 * itself are passed in: where the visitor is, and how to build a link.
 *
 * ## What a panel may assume about the provider
 *
 * That `RouteMessages` is above it - in its component *and in its
 * `pendingComponent`* - so a panel's loading fallback may translate without
 * mounting a provider of its own (`settings/devices.tsx` does). The guarantee is
 * structural rather than incidental: a panel's `pendingComponent` is rendered
 * into this layout's `<Outlet />`, and the `<Outlet />` only exists once the
 * function below has run, which is what mounts the provider.
 *
 * The one thing that is *not* covered by it is a `pendingComponent` on **this**
 * route. There is none today, and if one is added it renders in place of the
 * function below - above the provider, not inside it - so it must either avoid
 * translating or mount `RouteMessages` itself. Adding one does not invalidate any
 * panel's fallback; only this layout's own would need the extra care.
 */
export const Route = createFileRoute('/_main/_authenticated/settings')({
  component: SettingsLayout,
  /**
   * The strings the frame renders, warmed before it renders.
   *
   * `ensureQueryData` rather than a prefetch, because `RouteMessages` reads them
   * back with `useSuspenseQuery` and there is no Suspense boundary between it and
   * the document: an unwarmed entry does not degrade here, it suspends the whole
   * response.
   *
   * The session is deliberately not fetched. `_authenticated`'s `beforeLoad` has
   * already put it in the one cache entry every guard reads, and this layout has
   * no use for it - the frame renders nothing about the visitor.
   */
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      intlQueryOptions({
        locale: context.locale,
        namespaces: SETTINGS_NAMESPACES,
      }),
    )
  },
  /**
   * `noindex, nofollow` for the whole settings subtree, declared exactly once.
   *
   * The Next.js layout sets `robots: { index: false, follow: false }` and every
   * page beneath it inherits that; this is the same statement in the mechanism
   * this router has. TanStack Router merges the `head` of every matched route and
   * dedupes `meta` by `name`, preferring the deepest occurrence - so a panel
   * inherits this by saying nothing, and only a panel that deliberately wanted to
   * be indexed would restate the tag. `settingsPanelHead` therefore emits a title
   * and nothing else.
   *
   * Stated rather than assumed: TanStack Start emits no robots directive of its
   * own, and these are one person's account screens.
   */
  head: () => ({
    meta: [{ content: 'noindex, nofollow', name: 'robots' }],
  }),
  /**
   * The trail for `/settings` itself - a single "Settings" crumb.
   *
   * A panel declares its own two-crumb trail and wins by being deeper
   * (`breadcrumbOf`), and `/settings` inherits this one by declaring nothing at
   * all. See `#/components/layout/settings-breadcrumb`.
   */
  staticData: { breadcrumb: <SettingsBreadcrumb /> },
})

function SettingsLayout() {
  /**
   * Where the visitor is, as the router's *internal* pathname.
   *
   * Internal is the whole point: the Stage 3 rewrite has already stripped the
   * locale, so `/pl/settings/security` arrives here as `/settings/security` and
   * the shared rules in `settings-nav.ts` compare plain paths. A rule that had to
   * cope with a prefix would be a second copy of the locale routing.
   *
   * Subscribed through `useRouterState` rather than read from a match, because
   * the nav highlight and the narrow-screen behaviour have to change on every
   * navigation within the subtree - including the ones that do not remount this
   * layout.
   */
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <RouteMessages namespaces={SETTINGS_NAMESPACES}>
      <SettingsShellContent
        BackLink={MigrationLink}
        isRoot={isSettingsRootPath(pathname)}
        /*
          `MigrationLink` rather than the router's `Link`, and it is worth saying
          why now that it makes no difference: every panel the menu lists is
          migrated, so every entry resolves to an ordinary client-side navigation.
          What this keeps is the *rule* - ask the route tree per href, and load the
          Next.js app for a destination this one does not serve. A panel added to
          `SETTINGS_NAV_ITEMS` before its route exists then degrades to a document
          load into the application that does serve it, rather than to a TanStack
          not-found. Neither this file nor the shared nav model holds a list of
          which is which; `src/tests/settings-routes.test.ts` asserts that today
          the answer is "owned" for all of them.
        */
        nav={
          <SettingsNavContent
            LinkComponent={MigrationLink}
            pathname={pathname}
          />
        }
      >
        <Outlet />
      </SettingsShellContent>
    </RouteMessages>
  )
}
