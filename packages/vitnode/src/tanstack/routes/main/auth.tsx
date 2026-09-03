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

/**
 * `/login` - the sign-in card.
 *
 * Guest-only, decided before anything renders, so a signed-in visitor never sees
 * the form - not for a frame.
 *
 * `?returnTo=` names wherever they were heading, and it is theirs to supply - so
 * it goes through two questions in order. `postAuthDestination` answers whether
 * this app may send a browser there at all (`sanitizeReturnTo` rejects every
 * origin and scheme spelling, and the loop guard rejects the login page itself),
 * and `internalDestination` answers what the router wants to be handed.
 *
 * Expressed as redirect *options* rather than as a navigation, because the same
 * shape works in both environments: on the server the router turns it into an
 * HTTP redirect and in the browser into a client navigation. Nothing here
 * touches `window`, which a `beforeLoad` running during SSR does not have.
 *
 * **`to` rather than `href`.** A redirect carrying `href` is used verbatim by
 * `Router.resolveRedirect` - it never reaches `buildLocation`, so it would skip
 * the locale rewrite and drop a Polish visitor on the English page.
 * `internalDestination` returns the split shape for exactly that reason, and
 * strips the prefix off a `returnTo` that arrived carrying one.
 *
 * `ensureAuthState` rejects when the session could not be read at all, and that
 * rejection propagates: only a session the API actually answered can send
 * anybody anywhere.
 */
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
    /**
     * What a stranger may put in `?returnTo=` is the same question on every
     * VitNode install, so the contract is the package's. It keeps whatever
     * arrived and judges nothing - `sanitizeReturnTo` is the single answer to
     * whether a target is somewhere this app may navigate to, and it is applied
     * where the value is *used*.
     */
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

/**
 * `/register` - creating an account.
 *
 * Guest-only through the same predicate `/login` uses. There is no second guard
 * implementation here and there must not be, so "signed in" cannot come to mean
 * two different things on two pages.
 *
 * A signed-in visitor goes to the front page and only the front page. This route
 * takes **no `returnTo`**, because nothing sends one: the login card's "create an
 * account" link is a bare `/register`, and inventing a parameter here would be a
 * behaviour nothing asked for.
 *
 * `parseInternalDestination` rather than `href`, so the redirect goes through
 * `buildLocation` and the locale rewrite writes the prefix back - a Polish
 * visitor is sent to `/pl`, not to `/`.
 */
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

/**
 * `/login/reset-password` - requesting a recovery link, and using one.
 *
 * Password recovery only exists on a deployment that can send email - and "we
 * could not find out" is a third answer, not a fourth spelling of no.
 *
 * The API mails the reset link through the configured email adapter, so with no
 * adapter the form's submit could never arrive, which is why a disabled
 * deployment answers `notFound()` rather than rendering it.
 *
 * What is deliberately *not* answered the same way is a configuration that could
 * not be read. The fallback the config query degrades to says `isEmail: false` -
 * correct for the login form - and reading that as a boolean here turned an API
 * outage into a **404**: the application asserting the page does not exist
 * because it could not reach its own API, to a visitor holding a valid recovery
 * link. `passwordRecoveryAvailability` separates the two, and the outage takes
 * the router's ordinary error path instead.
 *
 * It sits in `beforeLoad` because the response *status* depends on it: the
 * router's server pass resolves the boundary before the stream opens and answers
 * 404 for a genuinely disabled deployment, so the status is right without this
 * route setting one by hand.
 *
 * `login_` in the file-based spelling meant "do not nest under `/login`". A
 * code-based route needs no such escape: it is a sibling because it is declared
 * as one, and the path says the rest.
 */
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
    /**
     * The loader re-runs when the *mode* changes, and only then - a different
     * token is the same screen. Without this it would warm the namespaces for
     * whichever screen the page was first opened with and never again, so
     * following a fresh recovery link from an already-open request form would
     * mount a provider for a set nobody fetched.
     */
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
    /**
     * Code-split like the screen it belongs to: the router preloads a
     * `notFoundComponent` only once a route has actually answered `notFound()`,
     * so nothing about the eager graph pays for a deployment that *can* send
     * email.
     */
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
