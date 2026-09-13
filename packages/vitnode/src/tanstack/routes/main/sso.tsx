import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import type { CoreAuthRouteFactory } from "../types";

import { normalizeSsoCallbackSearch } from "../../auth/route-search";
import { loadSsoCallbackRoute } from "../../auth/sso-route";
import { AuthPendingSkeleton } from "../../pending";
import { routeContext } from "../types";

export const ssoCallbackRoute: CoreAuthRouteFactory = ({ parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,

    validateSearch: normalizeSsoCallbackSearch,
    loader: async ({ context }) =>
      await loadSsoCallbackRoute(routeContext(context)),
    path: "/login/sso/$providerId",
    pendingComponent: AuthPendingSkeleton,
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const [{ SsoCallbackRouteContent }, { ErrorActions }] = await Promise.all(
        [import("../../auth/sso-screen"), import("../../layout/error-actions")],
      );

      return {
        default: function SsoCallbackRoute() {
          return (
            <SsoCallbackRouteContent
              errorActions={<ErrorActions />}
              providerId={route.useParams().providerId}
              search={route.useSearch()}
            />
          );
        },
      };
    }),
  });

  return route;
};
