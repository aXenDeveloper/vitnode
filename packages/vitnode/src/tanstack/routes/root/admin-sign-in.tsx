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
import { AuthPendingSkeleton } from "../../pending";
import { routeContext, routeSearch } from "../types";

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
    pendingComponent: AuthPendingSkeleton,
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
