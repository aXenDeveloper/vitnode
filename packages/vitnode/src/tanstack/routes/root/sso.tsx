import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import type { CoreRootRouteFactory } from "./types";

import { normalizeSsoCallbackSearch } from "../../auth/route-search";
import { loadSsoCallbackRoute } from "../../auth/sso-route";
import { AuthPendingSkeleton } from "../../pending";
import { routeContext } from "../types";

/**
 * `/login/sso/:providerId` - where an SSO provider sends the visitor back to.
 *
 * The URL shape is not an application's to choose: the API registers it with
 * every provider as `${NEXT_PUBLIC_WEB_URL}login/sso/<id>`, so whichever app
 * that origin serves has to answer it. `/login/sso/google` and
 * `/pl/login/sso/google` are one route - the locale is stripped before matching.
 */
export const ssoCallbackRoute: CoreRootRouteFactory = ({ parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    /**
     * What a provider may put in the callback URL - the package's contract, not
     * an application's.
     *
     * Which half arrives is the provider's decision, so nothing is required, and
     * nothing is coerced: an all-digit `state` reaches `validateSearch` as a
     * number, and a `z.string()` would throw on it, rendering an error boundary
     * in the middle of a sign-in the visitor had already approved. The values are
     * judged by `parseSsoCallback`, which bounds their length, classifies the
     * error rather than carrying it through, and is where the whole rule lives.
     */
    validateSearch: normalizeSsoCallbackSearch,
    loader: async ({ context }) =>
      await loadSsoCallbackRoute(routeContext(context)),
    path: "/login/sso/$providerId",
    pendingComponent: AuthPendingSkeleton,
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const [{ SsoCallbackRouteContent }, { ErrorActions }, { RouterLink }] =
        await Promise.all([
          import("../../auth/sso-screen"),
          import("../../layout/error-actions"),
          import("../../layout/router-link"),
        ]);

      return {
        default: function SsoCallbackRoute() {
          return (
            <SsoCallbackRouteContent
              errorActions={<ErrorActions />}
              LinkComponent={RouterLink}
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
