import {
  createRoute,
  lazyRouteComponent,
  notFound,
} from "@tanstack/react-router";

import type { CoreRouteFactory } from "../types";

/**
 * Every public URL this application does not serve - inside the site's own
 * shell.
 *
 * ## Why this is a route rather than a `notFoundComponent`
 *
 * Because a `notFoundComponent` on the main shell would never run. Router core
 * matches a path against the route tree first, and when nothing matches at all
 * the branch it hands back is the **root route alone** - see `getMatchedRoutes`,
 * which falls back to `[routesById["__root__"]]`. `findGlobalNotFoundRouteId`
 * then looks for a boundary within *that* branch, so a pathless layout the URL
 * never reached is not a candidate, whatever `notFoundMode` says. The shell's
 * header, its breadcrumb area and its `<main>` were therefore unreachable for
 * the one screen that most needs to look like the site: the 404.
 *
 * A splat that matches puts the branch back. `/blahblah` now matches this, which
 * means the main shell above it is matched too - so its loader runs, the header
 * gets the warm cache entry it reads with `useSuspenseQuery`, and the message
 * renders inside the same document every other page renders inside.
 *
 * ## It answers 404, and `beforeLoad` is what makes it one
 *
 * A route that simply *rendered* the message would serve it with a `200`, which
 * would tell a crawler the page exists. So `beforeLoad` answers `notFound()` and
 * the screen is this route's own `notFoundComponent`: the router resolves the
 * boundary on its server pass, before the stream opens, and the response is a
 * 404 - the same mechanism `/login/reset-password` uses on a deployment that
 * cannot send email.
 *
 * It is `beforeLoad` rather than a loader for a second reason, and it is the one
 * that keeps the shell above intact. A failure there stops the chain *at this
 * match*, so every loader before it still runs - which is exactly the main
 * shell's, and the shell's loader is what warms the cache entry the header reads
 * with `useSuspenseQuery`. There is nothing to wait for either way: this
 * answers synchronously and can never be pending, which is why it names no
 * pending shape.
 *
 * ## What it does not shadow
 *
 * Anything a real route declares. A splat is the lowest-ranked segment kind in
 * router core's matcher, and `isFrameMoreSpecific` prefers the frame with more
 * static segments - so `/discover`, `/docs/$`, `/api/$` and every plugin page
 * win against it, and only a path no route claims arrives here.
 *
 * `/admin/*` is the one boundary worth stating out loud. An admin URL that *is*
 * declared is matched by the AdminCP's own routes as before; one that is not -
 * a typo, a stale bookmark - lands here and gets the public 404 with the site
 * header rather than the AdminCP's. That is deliberate: the alternative is a
 * splat under `_admin`, which sits behind the admin guard and would answer a
 * mistyped URL by demanding a sign-in for a page that does not exist.
 */
export const notFoundRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    beforeLoad: (): never => {
      // TanStack Router's own control-flow signal, like `redirect()`: a typed
      // object the router catches, resolves to the boundary below, and turns
      // into a 404 on the server pass.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw notFound();
    },
    head: () => pageHead({ robots: "noindex, nofollow" }),
    path: "/$",
    notFoundComponent: lazyRouteComponent(async () => {
      const [{ NotFound }, { ErrorActions }] = await Promise.all([
        import("../../layout/not-found"),
        import("../../layout/error-actions"),
      ]);

      return {
        default: function NotFoundScreen() {
          return <NotFound actions={<ErrorActions />} />;
        },
      };
    }),
  });

  return route;
};
