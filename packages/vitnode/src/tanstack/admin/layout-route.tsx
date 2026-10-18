import type { QueryClient } from "@tanstack/react-query";

import { lazyRouteComponent, redirect } from "@tanstack/react-router";

import type { AdminNavBundle } from "@/views/admin/layouts/sidebar/nav/nav-model";

import type { AdminLoaderContext } from "./intl";

import { pageHead } from "../metadata";
import { loadAdminMessages } from "./intl";
import { adminReturnToFor } from "./return-to";
import { ensureAdminAccess, preloadAdminAccess } from "./session-query";
import { ADMIN_ENTRY_PATH, canEnterAdmin } from "./state";

/** Lazily imports the app's generated `src/admin-nav.gen.ts`. */
export type AdminNavModule = () => Promise<{ adminNav: AdminNavBundle }>;

/**
 * The route options of the AdminCP layout (`/_admin`): redirects anyone
 * without admin access to the AdminCP sign-in with a `returnTo`, loads the
 * navigation's messages, marks every page `noindex, nofollow` and lazily
 * renders the shell. Child routes get `adminAccess` in their context.
 *
 * @example
 * ```ts
 * // src/routes/_admin.tsx
 * import { createFileRoute } from "@tanstack/react-router";
 * import { adminLayoutRoute } from "@vitnode/core/tanstack/admin";
 *
 * export const Route = createFileRoute("/_admin")(
 *   adminLayoutRoute(async () => await import("@/admin-nav.gen")),
 * );
 * ```
 */
export const adminLayoutRoute = (navModule: AdminNavModule) => ({
  beforeLoad: async ({
    context,
    location,
    preload,
  }: {
    context: { queryClient: QueryClient };
    location: Parameters<typeof adminReturnToFor>[0];
    preload: boolean;
  }) => {
    const access = preload
      ? await preloadAdminAccess(context.queryClient)
      : await ensureAdminAccess(context.queryClient);

    if (!canEnterAdmin(access)) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw redirect({
        search: { returnTo: adminReturnToFor(location) },
        to: ADMIN_ENTRY_PATH,
      });
    }

    return { adminAccess: access };
  },

  loader: async ({ context }: { context: AdminLoaderContext }) => {
    const { adminNav } = await navModule();

    await loadAdminMessages({ ...context, namespaces: adminNav.namespaces });
  },

  head: () => pageHead({ robots: "noindex, nofollow" }),
  component: lazyRouteComponent(async () => {
    const [{ AdminShellContent }, { adminNav }] = await Promise.all([
      import("./shell"),
      navModule(),
    ]);

    return {
      default: function AdminLayout() {
        return <AdminShellContent nav={adminNav} />;
      },
    };
  }),
});
