import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { withCoreMainRoutes } from ".";
import { routeHead } from "../../metadata";

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

  it.each([
    "/login",
    "/register",
    "/login/reset-password",
    "/login/sso/google",
  ])("renders %s inside the main shell", pathname => {
    expect(branchFor(router, pathname)).toContain("/_main");
  });
});
