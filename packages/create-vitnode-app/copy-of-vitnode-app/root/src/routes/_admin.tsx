import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
  ADMIN_ENTRY_PATH,
  adminReturnToFor,
  canEnterAdmin,
  ensureAdminAccess,
  loadAdminMessages,
  preloadAdminAccess,
} from "@vitnode/core/tanstack/admin";
import { pageHead } from "@vitnode/core/tanstack/metadata";

import { AdminShell } from "@/components/admin-shell";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ context, location, preload }) => {
    const access = preload
      ? await preloadAdminAccess(context.queryClient)
      : await ensureAdminAccess(context.queryClient);

    if (!canEnterAdmin(access)) {
      // TanStack Router's own control-flow signal: `redirect()` returns a typed
      // redirect object that the router catches and turns into a navigation
      // (or, during SSR, a 302). Throwing it is what stops the guard.
      //
      // `/admin` is a sibling leaf, not a child of this route, so this cannot
      // loop: the sign-in page's own guard only redirects *away* on a granted
      // session, and `sanitizeAdminReturnTo` rejects `/admin` as a target.
      //
      // Cast because `/admin` is not in this router's type table: it is
      // `@vitnode/core`'s own declared route now, mounted by `withVitNodeRoutes`,
      // and code-based routes are outside the generated tree's types. The
      // *runtime* is unaffected, and `ADMIN_ENTRY_PATH` is the package's own
      // constant - so the path and the sign-in route that serves it are still one
      // fact in one place.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        search: { returnTo: adminReturnToFor(location) },
        to: ADMIN_ENTRY_PATH,
      } as unknown as Parameters<typeof redirect>[0]);
    }

    // Merged into the context of everything below, so a child route reads
    // `context.adminAccess` already narrowed to the granted half of the union.
    // It is the same object the guard decided on, from the same cache entry, so
    // a page cannot disagree with the guard that let it render.
    return { adminAccess: access };
  },

  loader: async ({ context }) => {
    const { adminNav } = await import("@/admin-nav.gen");

    await loadAdminMessages({ ...context, namespaces: adminNav.namespaces });
  },

  head: () => pageHead({ robots: "noindex, nofollow" }),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
