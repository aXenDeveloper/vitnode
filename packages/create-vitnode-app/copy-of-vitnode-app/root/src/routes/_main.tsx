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
 * `src/tests/main-shell.test.ts` asserts both halves - the settings paths
 * inside, the four auth screens outside.
 *
 * ## The slots
 *
 * `ThemeLayoutContent`'s, and this shell fills two of its three: `header` and
 * `breadcrumb`.
 *
 * `listeners` is deliberately left empty here. `/login` is outside this shell, so
 * a sign-in resync mounted here would not exist during the sign-in it has to
 * notice. The notification toasts and the WebSocket resync are mounted by
 * `__root` instead, next to the connection whose lifetime they share.
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
