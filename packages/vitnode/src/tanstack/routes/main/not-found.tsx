import {
  createRoute,
  lazyRouteComponent,
  notFound,
} from "@tanstack/react-router";

import type { CoreRouteFactory } from "../types";

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
