import type { QueryClient } from "@tanstack/react-query";

import { lazyRouteComponent, redirect } from "@tanstack/react-router";

import type { AdminNavBundle } from "@/views/admin/layouts/sidebar/nav/nav-model";

import type { AdminLoaderContext } from "./intl";

import { pageHead } from "../metadata";
import { loadAdminMessages } from "./intl";
import { adminReturnToFor } from "./return-to";
import { ensureAdminAccess, preloadAdminAccess } from "./session-query";
import { ADMIN_ENTRY_PATH, canEnterAdmin } from "./state";

export type AdminNavModule = () => Promise<{ adminNav: AdminNavBundle }>;

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
      // eslint-disable-next-line @typescript-eslint/only-throw-error
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
