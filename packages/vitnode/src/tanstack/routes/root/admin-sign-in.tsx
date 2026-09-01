import {
  createRoute,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";

import type { CoreRootRouteFactory } from "./types";

import { sanitizeAdminReturnTo } from "../../admin/return-to";
import { prefetchAdminAccess } from "../../admin/session-query";
import { loadAdminSignInRoute } from "../../admin/sign-in-route";
import { ADMIN_RETURN_TO_PARAM, canEnterAdmin } from "../../admin/state";
import { createAuthNavigation } from "../../auth/redirects";
import { routeContext, routeSearch } from "../types";

/**
 * `/admin` - the AdminCP's own sign-in screen.
 *
 * A **sibling** of the AdminCP shell rather than a child of it, which is what
 * stops the guard looping: the shell's `beforeLoad` sends a visitor without
 * access here, and this route only ever redirects *away* on a granted session.
 * `sanitizeAdminReturnTo` rejects `/admin` as a target for the same reason.
 *
 * The AdminCP has its own session under its own cookie, so this is not `/login`
 * with a different heading - it reads a different session through a different
 * endpoint, and an administrator may hold one and not the other.
 *
 * `?returnTo=` is kept as it arrived and judged nowhere near here:
 * `sanitizeAdminReturnTo` is the single answer to whether a target is somewhere
 * this app may navigate to, and it is applied where the value is *used*. Same
 * split as `/login`.
 */
export const adminSignInRoute: CoreRootRouteFactory = ({
  localeRouting,
  pageHead,
  parentRoute,
}) => {
  const { internalDestination, useAppNavigate } = createAuthNavigation({
    localeRouting,
  });

  const route = createRoute({
    getParentRoute: () => parentRoute,
    validateSearch: (
      search: Record<string, unknown>,
    ): { returnTo?: string } => ({
      returnTo:
        typeof search[ADMIN_RETURN_TO_PARAM] === "string"
          ? search[ADMIN_RETURN_TO_PARAM]
          : undefined,
    }),
    /**
     * `prefetchAdminAccess` rather than `ensureAdminAccess`: this is the page a
     * denied visitor lands on, so the question has usually just been asked and
     * the answer is in the cache. It returns `null` when it could not be read at
     * all, and a null answer stays on this page rather than asserting anything.
     */
    beforeLoad: async ({ context, search }) => {
      const access = await prefetchAdminAccess(
        routeContext<{
          queryClient: Parameters<typeof prefetchAdminAccess>[0];
        }>(context).queryClient,
      );

      if (!access || !canEnterAdmin(access)) return;

      const href = sanitizeAdminReturnTo(
        routeSearch<{ returnTo?: string }>(search).returnTo,
      );

      // TanStack Router's own control-flow signal - see `/login`.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect(internalDestination(href));
    },
    // `head` after `loader`, always.
    loader: async ({ context }) =>
      await loadAdminSignInRoute(routeContext(context)),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin",
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const { AdminSignInRouteContent } =
        await import("../../admin/sign-in-screen");

      return {
        default: function AdminSignInRoute() {
          return (
            <AdminSignInRouteContent
              navigate={useAppNavigate()}
              returnTo={route.useSearch().returnTo}
            />
          );
        },
      };
    }),
  });

  return route;
};
