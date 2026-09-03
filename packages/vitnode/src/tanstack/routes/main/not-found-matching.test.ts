import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { withCoreMainRoutes } from ".";
import { routeHead } from "../../metadata";

/**
 * The claim `not-found.tsx` rests on, checked against a real router.
 *
 * The reasoning is subtle enough to be worth a machine's opinion rather than a
 * comment's: a URL nothing matches makes router core hand back the **root route
 * alone**, so a `notFoundComponent` on a pathless shell the URL never reached
 * cannot be the boundary - and a splat *under* that shell is what puts the shell
 * back in the branch, header and `<main>` included.
 *
 * The tree is the shape every VitNode host composes - a root, a pathless `_main`
 * with one file-based child, and `withCoreMainRoutes` over it - built here so the
 * assertions are about the composition rather than about one application's
 * routes.
 */

const localeRouting = { deLocalizeUrl: (url: URL) => url };
const pageHead = () => routeHead({ shortTitle: "VitNode", title: "VitNode" });

const buildRouter = ({ withCoreRoutes }: { withCoreRoutes: boolean }) => {
  const rootRoute = createRootRoute();
  const mainShell = createRoute({
    component: Outlet,
    getParentRoute: () => rootRoute,
    id: "_main",
  });
  const home = createRoute({ getParentRoute: () => mainShell, path: "/" });

  /*
    The branches an application keeps beside the main shell: the API's server
    route, the documentation splat, and the AdminCP behind its own pathless
    guard. They are here because they are what a root-level catch-all could
    plausibly swallow.
  */
  const api = createRoute({ getParentRoute: () => rootRoute, path: "/api/$" });
  const docsIndex = createRoute({
    getParentRoute: () => rootRoute,
    path: "/docs/",
  });
  const docsPage = createRoute({
    getParentRoute: () => rootRoute,
    path: "/docs/$",
  });
  const adminShell = createRoute({
    component: Outlet,
    getParentRoute: () => rootRoute,
    id: "_admin",
  });
  const adminCore = createRoute({
    getParentRoute: () => adminShell,
    path: "/admin/core/",
  });

  adminShell.addChildren([adminCore]);
  mainShell.addChildren([home]);
  rootRoute.addChildren([mainShell, adminShell, api, docsIndex, docsPage]);

  if (withCoreRoutes) {
    withCoreMainRoutes(rootRoute, {
      localeRouting,
      mountUnder: mainShell,
      pageHead,
    });
  }

  return createRouter({ routeTree: rootRoute });
};

/** The ids of every route a path matches, outermost first. */
const branchFor = (
  router: ReturnType<typeof buildRouter>,
  pathname: string,
): string[] =>
  router.getMatchedRoutes(pathname)[0].map((route: { id: string }) => route.id);

describe("an unmatched URL, without the catch-all", () => {
  const router = buildRouter({ withCoreRoutes: false });

  /**
   * The whole reason the 404 is a route. The shell is not in the branch, so
   * nothing mounted under it - a `notFoundComponent`, a header, the `<main>`
   * landmark - can be reached for this URL.
   */
  it("matches the root route and nothing else", () => {
    expect(branchFor(router, "/blahblah")).toEqual(["__root__"]);
  });
});

describe("an unmatched URL, with it", () => {
  const router = buildRouter({ withCoreRoutes: true });

  it("matches the shell, so the header and <main> render around it", () => {
    const branch = branchFor(router, "/blahblah");

    expect(branch[0]).toBe("__root__");
    expect(branch).toContain("/_main");
    expect(branch.at(-1)).toContain("$");
  });

  /** Including a path several segments deep, and an admin URL no route claims. */
  it.each(["/blahblah", "/one/two/three", "/admin/typo-not-real"])(
    "catches %s",
    pathname => {
      expect(branchFor(router, pathname)).toContain("/_main");
    },
  );

  /**
   * And it shadows nothing. A splat is the lowest-ranked segment kind in router
   * core's matcher, so every screen that declares a path still wins - which is
   * what makes mounting it beside them safe.
   */
  it.each([
    ["/", "/"],
    ["/login", "/login"],
    ["/register", "/register"],
    ["/login/reset-password", "/login/reset-password"],
    ["/login/sso/google", "/login/sso/$providerId"],
    ["/discover", "/discover"],
    ["/api/core/session", "/api/$"],
    ["/docs", "/docs/"],
    ["/docs/dev/routing/not-found", "/docs/$"],
    ["/admin/core", "/admin/core/"],
  ])("serves %s from its own route", (pathname, path) => {
    const matched = router.getMatchedRoutes(pathname)[2] as
      undefined | { fullPath: string };

    expect(matched?.fullPath).toBe(path);
  });

  /**
   * The auth screens are children of the shell now, which is the other half of
   * this change: they render with the site header above them rather than on an
   * otherwise empty document.
   */
  it.each([
    "/login",
    "/register",
    "/login/reset-password",
    "/login/sso/google",
  ])("renders %s inside the main shell", pathname => {
    expect(branchFor(router, pathname)).toContain("/_main");
  });
});
