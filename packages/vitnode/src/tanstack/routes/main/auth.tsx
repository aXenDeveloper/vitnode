import {
  createRoute,
  lazyRouteComponent,
  notFound,
  redirect,
} from "@tanstack/react-router";

import type { CoreAuthRouteFactory } from "../types";

import { loadLoginRoute } from "../../auth/login-route";
import { middlewareConfigQueryOptions } from "../../auth/middleware-config";
import {
  normalizePasswordResetSearch,
  passwordRecoveryAvailability,
  PasswordRecoveryUnknownError,
  passwordResetMode,
} from "../../auth/recovery";
import { loadPasswordResetRoute } from "../../auth/recovery-route";
import {
  createAuthNavigation,
  parseInternalDestination,
  postAuthDestination,
} from "../../auth/redirects";
import { loadRegisterRoute } from "../../auth/register-route";
import { normalizeLoginSearch } from "../../auth/route-search";
import { ensureAuthState } from "../../auth/session-query";
import { canAccessGuestRoute } from "../../auth/state";
import { AuthPendingSkeleton } from "../../pending";
import { routeContext, routeSearch } from "../types";

const loginRoute: CoreAuthRouteFactory = ({
  localeRouting,
  pageHead,
  parentRoute,
}) => {
  const { internalDestination, useAppNavigate } = createAuthNavigation({
    localeRouting,
  });

  const route = createRoute({
    getParentRoute: () => parentRoute,

    validateSearch: normalizeLoginSearch,
    beforeLoad: async ({ context, search }) => {
      const auth = await ensureAuthState(
        routeContext<{ queryClient: Parameters<typeof ensureAuthState>[0] }>(
          context,
        ).queryClient,
      );

      if (canAccessGuestRoute(auth)) return;

      const href = postAuthDestination(
        routeSearch<{ returnTo?: string }>(search).returnTo,
      );

      // TanStack Router's own control-flow signal: a typed redirect object the
      // router catches and turns into a navigation (or, during SSR, a 302).
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect(internalDestination(href));
    },
    // `head` after `loader`, always.
    loader: async ({ context }) => await loadLoginRoute(routeContext(context)),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/login",
    pendingComponent: AuthPendingSkeleton,
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const [{ LoginRouteContent }, { RouterLink }] = await Promise.all([
        import("../../auth/login-screen"),
        import("../../layout/router-link"),
      ]);

      return {
        default: function LoginRoute() {
          return (
            <LoginRouteContent
              LinkComponent={RouterLink}
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

const registerRoute: CoreAuthRouteFactory = ({
  localeRouting,
  pageHead,
  parentRoute,
}) => {
  const { useAppNavigate } = createAuthNavigation({ localeRouting });

  const route = createRoute({
    getParentRoute: () => parentRoute,
    beforeLoad: async ({ context }) => {
      const auth = await ensureAuthState(
        routeContext<{ queryClient: Parameters<typeof ensureAuthState>[0] }>(
          context,
        ).queryClient,
      );

      if (canAccessGuestRoute(auth)) return;

      // TanStack Router's own control-flow signal - see `/login` above.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect(parseInternalDestination(postAuthDestination(undefined)));
    },
    // `head` after `loader`, always.
    loader: async ({ context }) =>
      await loadRegisterRoute(routeContext(context)),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/register",
    pendingComponent: AuthPendingSkeleton,
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const [{ RegisterRouteContent }, { RouterLink }] = await Promise.all([
        import("../../auth/register-screen"),
        import("../../layout/router-link"),
      ]);

      return {
        default: function RegisterRoute() {
          return (
            <RegisterRouteContent
              LinkComponent={RouterLink}
              navigate={useAppNavigate()}
            />
          );
        },
      };
    }),
  });

  return route;
};

const passwordResetRoute: CoreAuthRouteFactory = ({
  pageHead,
  parentRoute,
}) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    validateSearch: normalizePasswordResetSearch,
    beforeLoad: async ({ context }) => {
      const availability = passwordRecoveryAvailability(
        await routeContext<{
          queryClient: {
            ensureQueryData: (options: unknown) => Promise<never>;
          };
        }>(context).queryClient.ensureQueryData(middlewareConfigQueryOptions()),
      );

      // Not a 404: the route exists, the API could not say whether the flow does.
      if (availability === "unknown") throw new PasswordRecoveryUnknownError();

      // TanStack Router's own control-flow signal, like `redirect()`.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      if (availability === "disabled") throw notFound();
    },

    loaderDeps: ({ search }) => ({
      mode: passwordResetMode(routeSearch(search)).mode,
    }),
    // `head` after `loader`, always.
    loader: async ({ context, deps }) =>
      await loadPasswordResetRoute({
        ...routeContext<Parameters<typeof loadPasswordResetRoute>[0]>(context),
        mode: deps.mode,
      }),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/login/reset-password",
    pendingComponent: AuthPendingSkeleton,

    notFoundComponent: lazyRouteComponent(async () => {
      const [{ PasswordRecoveryNotFound }, { ErrorActions }] =
        await Promise.all([
          import("../../auth/recovery-screen"),
          import("../../layout/error-actions"),
        ]);

      return {
        default: function PasswordRecoveryNotFoundScreen() {
          return <PasswordRecoveryNotFound actions={<ErrorActions />} />;
        },
      };
    }),
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const { PasswordResetRouteContent } =
        await import("../../auth/recovery-screen");

      return {
        default: function PasswordResetRoute() {
          return (
            <PasswordResetRouteContent
              namespaces={route.useLoaderData().namespaces}
              search={route.useSearch()}
            />
          );
        },
      };
    }),
  });

  return route;
};

/** The three public auth screens. */
export const coreAuthRoutes: CoreAuthRouteFactory[] = [
  loginRoute,
  registerRoute,
  passwordResetRoute,
];
