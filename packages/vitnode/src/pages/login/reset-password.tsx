import { notFound } from "@tanstack/react-router";

import type { PluginRoutePageProps } from "@/routing";
import type { PasswordResetSearch } from "@/tanstack/auth/recovery";
import type { PasswordResetRouteData } from "@/tanstack/auth/recovery-route";

import { middlewareConfigQueryOptions } from "@/tanstack/auth/middleware-config";
import {
  passwordRecoveryAvailability,
  PasswordRecoveryUnknownError,
  passwordResetMode,
} from "@/tanstack/auth/recovery";
import { loadPasswordResetRoute } from "@/tanstack/auth/recovery-route";
import {
  PasswordRecoveryNotFound,
  PasswordResetRouteContent,
} from "@/tanstack/auth/recovery-screen";
import { ErrorActions } from "@/tanstack/layout/error-actions";
import { defineRoute } from "@/tanstack/plugin-routes";

const PasswordResetPage = ({
  loaderData,
  search,
}: PluginRoutePageProps<PasswordResetRouteData, PasswordResetSearch>) => (
  <PasswordResetRouteContent
    namespaces={loaderData.namespaces}
    search={search}
  />
);

export const route = defineRoute<PasswordResetRouteData, PasswordResetSearch>({
  /**
   * The availability check runs first, and it is not a session guard - it asks
   * whether this installation offers password recovery at all. It lived in
   * `beforeLoad` when this route was built by hand; at the top of `load` it runs
   * at the same point for the same reason, before anything is fetched.
   */
  load: async ({ context, search }) => {
    const availability = passwordRecoveryAvailability(
      await context.queryClient.query({
        ...middlewareConfigQueryOptions(),
        staleTime: "static",
      }),
    );

    // Not a 404: the route exists, the API could not say whether the flow does.
    if (availability === "unknown") throw new PasswordRecoveryUnknownError();

    // TanStack Router's own control-flow signal, like `redirect()`.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (availability === "disabled") throw notFound();

    return await loadPasswordResetRoute({
      ...context,
      mode: passwordResetMode(search).mode,
    });
  },
  head: ({ t }) => ({ title: t("core.auth.reset_password.title") }),

  notFound: function PasswordRecoveryNotFoundScreen() {
    return <PasswordRecoveryNotFound actions={<ErrorActions />} />;
  },
});

export default PasswordResetPage;
