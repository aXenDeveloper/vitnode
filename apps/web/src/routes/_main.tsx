import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ThemeLayoutContent } from '@vitnode/core/views/layouts/theme/layout-content'

import { headerIntlQueryOptions } from '#/components/header'
import { MainBreadcrumb } from '#/components/layout/main-breadcrumb'
import { MainHeader } from '#/components/layout/main-header'
import { prefetchSession } from '#/lib/auth/query'

/**
 * The main application shell - the header, the breadcrumb area and the one
 * `<main>` landmark that every public page renders inside.
 *
 * Pathless, so it contributes no URL segment: `/discover` is `/discover`, not
 * `/_main/discover`. A page joins the shell by *where its file lives*, which is
 * the same rule `_authenticated` uses for the session guard - and the reason
 * `_authenticated` now lives underneath this one: a signed-in page is still a
 * page on the public site, so it wants the shell *and* the guard rather than a
 * second copy of the shell.
 *
 * ## What is deliberately outside it
 *
 * The four auth screens: `/login`, `/login/sso/$providerId`, `/register` and
 * `/login/reset-password`. An auth screen is a full-height card on an otherwise
 * empty document, and the header it would render is a header whose only
 * interesting control is "sign in". Keeping them out is what makes this a shell
 * that routes opt into rather than one every route is subject to.
 * `routes/api/$` is outside for a different reason: it is a server route and
 * renders no document at all.
 *
 * Note this is a visual difference from the Next.js app, where all four sit
 * inside `(main)` and do render the header.
 *
 * ## What Stage 9 put *under* it
 *
 * The settings subtree, and that direction is the point: `/settings` and its
 * panels are pages on the public site that happen to need a session, so they go
 * under this shell and then under `_authenticated`, and inherit the header, the
 * breadcrumb area, the `<main>` landmark and the guard from where their files
 * live. Nothing in `routes/_main/_authenticated/settings*` renders a header, a
 * landmark or a session check of its own. `src/tests/main-shell.test.ts` asserts
 * both halves - the settings paths inside, the four auth screens outside.
 *
 * ## The slots
 *
 * `ThemeLayoutContent`'s, and two of the same three the Next.js `ThemeLayout`
 * fills: `header` and `breadcrumb`.
 *
 * `listeners` is deliberately left empty here. The Next.js app puts the
 * notification toasts and the WebSocket's sign-in resync in it because its
 * `/login` is inside the main shell; this app's is not, so a sync mounted here
 * would not exist during the sign-in it has to notice. They are mounted by
 * `__root` instead, next to the connection whose lifetime they share - see
 * `#/components/realtime-listeners`. The slot stays in the shared component for
 * the framework that has somewhere to put it.
 *
 * ## What it is not
 *
 * A provider. Every technical provider this app has - the QueryClient, the two
 * intl records, the theme, the WebSocket - is mounted once by `__root`, above
 * every route, because a login screen needs them just as much as a page under
 * this shell does. What lives here is structure: markup, and where the slots go.
 */
export const Route = createFileRoute('/_main')({
  component: MainLayout,
  /**
   * What the header needs, warmed before anything renders.
   *
   * Both entries are the app's canonical ones - the same query definitions the
   * routes below and the auth guards already use - so this adds no second key
   * and no second request. What it adds is *timing*: the header sits above every
   * page in the shell, so anything it reads has to be in hand before the first
   * paint or the shell pays a round trip that the page below it did not.
   *
   * ## One `ensure`, one `prefetch`, and the difference matters
   *
   * `ensureQueryData` for the messages, because `Header` reads them with
   * `useSuspenseQuery` and there is no Suspense boundary between it and the
   * document. An unwarmed entry there does not degrade - it suspends the whole
   * response. The namespace list is part of the query key, which is why the
   * options come from `headerIntlQueryOptions` rather than being spelled out: a
   * loader that warmed a different set would warm a key nobody reads.
   *
   * `prefetchQuery` for the session, through `prefetchSession`, because a
   * failure must not take the page down with it. `ensureAuthState` is the wrong
   * tool here in one specific way: it *rejects* when the session cannot be read,
   * which is exactly right for a guard - an outage must not sign anybody out -
   * and exactly wrong for a shell, where the same rejection would replace every
   * page on the site with an error screen because the header could not name the
   * visitor. Prefetching records the failure in the cache entry instead, and
   * `userHeaderState` renders it as the guest controls.
   *
   * So the session is a performance concern here and a correctness one in
   * `_authenticated`, and both reach the one entry `lib/auth/query.ts` owns.
   *
   * `Promise.all`, because neither read depends on the other.
   */
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        headerIntlQueryOptions({ locale: context.locale }),
      ),
      prefetchSession(context.queryClient),
    ])
  },
})

function MainLayout() {
  return (
    <ThemeLayoutContent breadcrumb={<MainBreadcrumb />} header={<MainHeader />}>
      <Outlet />
    </ThemeLayoutContent>
  )
}
