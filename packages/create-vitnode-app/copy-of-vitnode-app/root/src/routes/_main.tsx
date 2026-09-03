import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MainBreadcrumb } from "@vitnode/core/tanstack/breadcrumb";
import {
  loadMainShell,
  ThemeLayoutContent,
} from "@vitnode/core/tanstack/layout";

import { MainHeader } from "#/components/main-header";

/**
 * The main application shell - the header, the breadcrumb area and the one
 * `<main>` landmark that every public page renders inside.
 *
 * Pathless, so it contributes no URL segment: `/discover` is `/discover`, not
 * `/_main/discover`. A page joins the shell by *where its file lives*, which is
 * the same rule `_authenticated` uses for the session guard - and the reason
 * `_authenticated` lives underneath this one: a signed-in page is still a page
 * on the public site, so it wants the shell *and* the guard rather than a second
 * copy of the shell.
 *
 * ## What is inside it, and what is deliberately outside
 *
 * Everything a visitor can reach without the AdminCP, the four public auth
 * screens included: `/login`, `/register`, `/login/reset-password` and
 * `/login/sso/$providerId` are children of this shell, mounted by
 * `withCoreMainRoutes`. An auth card is a page on the public site - its own
 * layout already reserves the space the header takes, and the header is the way
 * back to the front page from a form the visitor changed their mind about.
 *
 * So is the 404. A URL no route matched is answered by core's `/$` inside this
 * container rather than by `__root`'s `notFoundComponent`, because router core
 * hands back the root route alone when nothing matches - a pathless layout the
 * URL never reached is not a candidate for the boundary, whatever `notFoundMode`
 * says, so a screen mounted here could never have seen one.
 *
 * `/admin` - the AdminCP's own sign-in - is outside, and must be: it reads a
 * different session under a different cookie, so offering the site header's
 * "sign in" beside it would be one page asking for two unrelated logins.
 * `routes/api/$` is outside for a different reason again: it is a server route
 * and renders no document at all.
 *
 * ## The slots
 *
 * `ThemeLayoutContent`'s, and two of the same three the Next.js `ThemeLayout`
 * fills: `header` and `breadcrumb`.
 *
 * `listeners` is deliberately left empty here. The notification toasts and the
 * WebSocket's sign-in resync are mounted by `__root` instead, next to the
 * connection whose lifetime they share - so a sign-out that lands the visitor
 * outside this shell is still noticed, which a listener scoped to the shell
 * could not manage.
 *
 * ## What it is not
 *
 * A provider. Every technical provider this app has - the QueryClient, the two
 * intl records, the theme, the WebSocket - is mounted once by `__root`, above
 * every route, because a login screen needs them just as much as a page under
 * this shell does. What lives here is structure: markup, and where the slots go.
 */
export const Route = createFileRoute("/_main")({
  loader: async ({ context }) => await loadMainShell(context),
  component: MainLayout,
});

function MainLayout() {
  return (
    <ThemeLayoutContent breadcrumb={<MainBreadcrumb />} header={<MainHeader />}>
      <Outlet />
    </ThemeLayoutContent>
  );
}
